# Frida Setup

Installer script for Frida and Burp's certificate to help setup bypass SSL Pinning in Android applications. 
Works with Genymotion Emulator.

Read the blog post for a detailed walkthrough -> <a href="https://blog.dixitaditya.com/one-click-ssl-pinning-bypass-setup/">One-click SSL-Pinning Bypass Setup</a>
## Installation steps

* Make sure you have a device installed in Genymotion and it's up and running so the script can interact with ADB.
* Start and keep Burp running so it can download the certificate.
* Run the `frida_setup.sh` to start the installer.

## Workflow

* Installs `frida` and `frida-tools` using pip. (Export the path to frida in your env if it's not already there)
* Fetches the latest released version of Frida server from github.
* Downloads certificate from Burp's proxy.
* Pushes and installs the required files inside the ADB.
* Cleans up the files and a reboot of the android system.

## Post-Installation

* Run the frida server from `/data/local/tmp` inside `adb shell`.
* Setup your proxies in Burp and Android's Wifi settings.
* Start the ssl-pinning bypass using `frida -U -f <package_name> -l frida2.js --no-pause`

#### Note: 

* Tested only on Arch Linux. Might have to change the `sed` command accordingly if you're on MacOS.
* Adjust `pip` to `pip3` if needed in the script.
* Highly recommend using `frida2.js` rather than `frida.js`.
