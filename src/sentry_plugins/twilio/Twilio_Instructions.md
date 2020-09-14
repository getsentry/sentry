## Installation
`$ pip install sentry-twilio`

Sentry will automagically detect that it has been installed.

## Configuration
`sentry-twilio` needs 4 pieces of information to set this up correctly.

### Account SID & Auth Token
The Account SID and Auth Token can both be found on your [Twilio account dashboard](https://www.twilio.com/user/account).
![](http://i.imgur.com/Km3cI.png)

### SMS From #
This is the number that was purchased through Twilio. [Twilio documentation for more information](https://www.twilio.com/help/faq/phone-numbers).

Examples:
```
+13305093095
// or
5551234567
```

### SMS To #'s
A list of phone numbers to send to separated by commas.

Example:
```
+13305093095, 5551234567
```
