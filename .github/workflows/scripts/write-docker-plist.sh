#!/bin/bash
# This is a script to generate a dynamic plist for the Docker installation on Mac
# Major hack. See details: https://github.com/docker/for-mac/issues/2359#issuecomment-908628717
version=$(defaults read /Applications/Docker.app/Contents/Info.plist VmnetdVersion)

cat >/Library/LaunchDaemons/com.docker.vmnetd.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.docker.vmnetd</string>
	<key>Program</key>
	<string>/Library/PrivilegedHelperTools/com.docker.vmnetd</string>
	<key>ProgramArguments</key>
	<array>
		<string>/Library/PrivilegedHelperTools/com.docker.vmnetd</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>Sockets</key>
	<dict>
		<key>Listener</key>
		<dict>
			<key>SockPathMode</key>
			<integer>438</integer>
			<key>SockPathName</key>
			<string>/var/run/com.docker.vmnetd.sock</string>
		</dict>
	</dict>
	<key>Version</key>
	<string>${version}</string>
</dict>
</plist>
EOF
