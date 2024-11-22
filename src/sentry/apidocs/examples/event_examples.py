from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.issues.endpoints.project_event_details import GroupEventDetailsResponse

SIMPLE_EVENT = {
    "eventID": "9fac2ceed9344f2bbfdd1fdacb0ed9b1",
    "tags": [
        {"key": "browser", "value": "Chrome 60.0"},
        {"key": "device", "value": "Other"},
        {"key": "environment", "value": "production"},
        {"value": "fatal", "key": "level"},
        {"key": "os", "value": "Mac OS X 10.12.6"},
        {"value": "CPython 2.7.16", "key": "runtime"},
        {"key": "release", "value": "17642328ead24b51867165985996d04b29310337"},
        {"key": "server_name", "value": "web1.example.com"},
    ],
    "dateCreated": "2020-09-11T17:46:36Z",
    "user": None,
    "message": "",
    "title": "This is an example Python exception",
    "id": "dfb1a2d057194e76a4186cc8a5271553",
    "platform": "python",
    "event.type": "error",
    "groupID": "1889724436",
    "crashFile": None,
    "location": "example.py:123",
    "culprit": "/books/new/",
    "projectID": "49271",
    "metadata": None,
}

GROUP_EVENT: GroupEventDetailsResponse = {
    "groupID": "1341191803",
    "eventID": "9999aaaaca8b46d797c23c6077c6ff01",
    "dist": None,
    "userReport": None,
    "previousEventID": None,
    "message": "",
    "title": "This is an example Python exception",
    "id": "9999aaafcc8b46d797c23c6077c6ff01",
    "size": 107762,
    "errors": [
        {
            "data": {
                "column": 8,
                "source": "https://s1.sentry-cdn.com/_static/bloopbloop/sentry/dist/app.js.map",
                "row": 15,
            },
            "message": "Invalid location in sourcemap",
            "type": "js_invalid_sourcemap_location",
        }
    ],
    "platform": "javascript",
    "nextEventID": "99f9e199e9a74a14bfef6196ad741619",
    "type": "error",
    "metadata": {
        "type": "ForbiddenError",
        "value": "GET /organizations/hellboy-meowmeow/users/ 403",
    },
    "tags": [
        {"value": "Chrome 83.0.4103", "key": "browser"},
        {"value": "Chrome", "key": "browser.name"},
        {"value": "prod", "key": "environment"},
        {"value": "yes", "key": "handled"},
        {"value": "error", "key": "level"},
        {"value": "generic", "key": "mechanism"},
    ],
    "dateCreated": datetime.fromisoformat("2020-06-17T22:26:56.098086Z"),
    "dateReceived": datetime.fromisoformat("2020-06-17T22:26:56.428721Z"),
    "user": {
        "username": None,
        "name": "Hell Boy",
        "ip_address": "192.168.1.1",
        "email": "hell@boy.cat",
        "data": {"isStaff": False},
        "id": "550747",
    },
    "entries": [
        {
            "type": "exception",
            "data": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "ignoreOnError",
                                    "errors": None,
                                    "colNo": 23,
                                    "vars": None,
                                    "package": None,
                                    "absPath": "webpack:////usr/src/getsentry/src/sentry/node_modules/@sentry/browser/esm/helpers.js",
                                    "inApp": False,
                                    "lineNo": 71,
                                    "module": "usr/src/getsentry/src/sentry/node_modules/@sentry/browser/esm/helpers",
                                    "filename": "/usr/src/getsentry/src/sentry/node_modules/@sentry/browser/esm/helpers.js",
                                    "platform": None,
                                    "instructionAddr": None,
                                    "context": [
                                        [66, "            }"],
                                        [67, "            // Attempt to invoke user-land function"],
                                        [
                                            68,
                                            "            // NOTE: If you are a Sentry user, and you are seeing this stack frame, it",
                                        ],
                                        [
                                            69,
                                            "            //       means the sentry.javascript SDK caught an error invoking your application code. This",
                                        ],
                                        [
                                            70,
                                            "            //       is expected behavior and NOT indicative of a bug with sentry.javascript.",
                                        ],
                                        [
                                            71,
                                            "            return fn.apply(this, wrappedArguments);",
                                        ],
                                        [72, "            // tslint:enable:no-unsafe-any"],
                                        [73, "        }"],
                                        [74, "        catch (ex) {"],
                                        [75, "            ignoreNextOnError();"],
                                        [76, "            withScope(function (scope) {"],
                                    ],
                                    "symbolAddr": None,
                                    "trust": None,
                                    "symbol": None,
                                },
                                {
                                    "function": "apply",
                                    "errors": None,
                                    "colNo": 24,
                                    "vars": None,
                                    "package": None,
                                    "absPath": "webpack:////usr/src/getsentry/src/sentry/node_modules/reflux-core/lib/PublisherMethods.js",
                                    "inApp": False,
                                    "lineNo": 74,
                                    "module": "usr/src/getsentry/src/sentry/node_modules/reflux-core/lib/PublisherMethods",
                                    "filename": "/usr/src/getsentry/src/sentry/node_modules/reflux-core/lib/PublisherMethods.js",
                                    "platform": None,
                                    "instructionAddr": None,
                                    "context": [
                                        [69, "     */"],
                                        [70, "    triggerAsync: function triggerAsync() {"],
                                        [71, "        var args = arguments,"],
                                        [72, "            me = this;"],
                                        [73, "        _.nextTick(function () {"],
                                        [74, "            me.trigger.apply(me, args);"],
                                        [75, "        });"],
                                        [76, "    },"],
                                        [77, ""],
                                        [78, "    /**"],
                                        [
                                            79,
                                            "     * Wraps the trigger mechanism with a deferral function.",
                                        ],
                                    ],
                                    "symbolAddr": None,
                                    "trust": None,
                                    "symbol": None,
                                },
                            ],
                            "framesOmitted": None,
                            "registers": None,
                            "hasSystemFrames": True,
                        },
                        "module": None,
                        "rawStacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "errors": None,
                                    "colNo": 88800,
                                    "vars": None,
                                    "package": None,
                                    "absPath": "https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js",
                                    "inApp": False,
                                    "lineNo": 81,
                                    "module": None,
                                    "filename": "/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js",
                                    "platform": None,
                                    "instructionAddr": None,
                                    "context": [
                                        [76, "/*!"],
                                        [77, "  Copyright (c) 2018 Jed Watson."],
                                        [78, "  Licensed under the MIT License (MIT), see"],
                                        [79, "  http://jedwatson.github.io/react-select"],
                                        [80, "*/"],
                                        [
                                            81,
                                            "{snip} e,t)}));return e.handleEvent?e.handleEvent.apply(this,s):e.apply(this,s)}catch(e){throw c(),Object(o.m)((function(n){n.addEventProcessor((fu {snip}",
                                        ],
                                        [82, "/*!"],
                                        [83, " * JavaScript Cookie v2.2.1"],
                                        [84, " * https://github.com/js-cookie/js-cookie"],
                                        [85, " *"],
                                        [86, " * Copyright 2006, 2015 Klaus Hartl & Fagner Brack"],
                                    ],
                                    "symbolAddr": None,
                                    "trust": None,
                                    "symbol": None,
                                },
                                {
                                    "function": None,
                                    "errors": None,
                                    "colNo": 149484,
                                    "vars": None,
                                    "package": None,
                                    "absPath": "https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js",
                                    "inApp": False,
                                    "lineNo": 119,
                                    "module": None,
                                    "filename": "/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js",
                                    "platform": None,
                                    "instructionAddr": None,
                                    "context": [
                                        [114, "/* @license"],
                                        [115, "Papa Parse"],
                                        [116, "v5.2.0"],
                                        [117, "https://github.com/mholt/PapaParse"],
                                        [118, "License: MIT"],
                                        [
                                            119,
                                            "{snip} (){var e=arguments,t=this;r.nextTick((function(){t.trigger.apply(t,e)}))},deferWith:function(e){var t=this.trigger,n=this,r=function(){t.app {snip}",
                                        ],
                                        [120, "/**!"],
                                        [
                                            121,
                                            " * @fileOverview Kickass library to create and place poppers near their reference elements.",
                                        ],
                                        [122, " * @version 1.16.1"],
                                        [123, " * @license"],
                                        [
                                            124,
                                            " * Copyright (c) 2016 Federico Zivolo and contributors",
                                        ],
                                    ],
                                    "symbolAddr": None,
                                    "trust": None,
                                    "symbol": None,
                                },
                            ],
                            "framesOmitted": None,
                            "registers": None,
                            "hasSystemFrames": True,
                        },
                        "mechanism": {"type": "generic", "handled": True},
                        "threadId": None,
                        "value": "GET /organizations/hellboy-meowmeow/users/ 403",
                        "type": "ForbiddenError",
                    }
                ],
                "excOmitted": None,
                "hasSystemFrames": True,
            },
        },
        {
            "type": "breadcrumbs",
            "data": {
                "values": [
                    {
                        "category": "tracing",
                        "level": "debug",
                        "event_id": None,
                        "timestamp": "2020-06-17T22:26:55.266586Z",
                        "data": None,
                        "message": "[Tracing] pushActivity: idleTransactionStarted#1",
                        "type": "debug",
                    },
                    {
                        "category": "xhr",
                        "level": "info",
                        "event_id": None,
                        "timestamp": "2020-06-17T22:26:55.619446Z",
                        "data": {
                            "url": "/api/0/internal/health/",
                            "status_code": 200,
                            "method": "GET",
                        },
                        "message": None,
                        "type": "http",
                    },
                    {
                        "category": "sentry.transaction",
                        "level": "info",
                        "event_id": None,
                        "timestamp": "2020-06-17T22:26:55.945016Z",
                        "data": None,
                        "message": "7787a027f3fb46c985aaa2287b3f4d09",
                        "type": "default",
                    },
                ]
            },
        },
        {
            "type": "request",
            "data": {
                "fragment": None,
                "cookies": [],
                "inferredContentType": None,
                "env": None,
                "headers": [
                    [
                        "User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36",
                    ]
                ],
                "url": "https://sentry.io/organizations/hellboy-meowmeow/issues/",
                "query": [["project", "5236886"]],
                "data": None,
                "method": None,
            },
        },
    ],
    "packages": {},
    "sdk": {"version": "5.17.0", "name": "sentry.javascript.browser"},
    "_meta": {
        "user": None,
        "context": None,
        "entries": {},
        "contexts": None,
        "message": None,
        "packages": None,
        "tags": {},
        "sdk": None,
    },
    "contexts": {
        "ForbiddenError": {
            "status": 403,
            "statusText": "Forbidden",
            "responseJSON": {"detail": "You do not have permission to perform this action."},
            "type": "default",
        },
        "browser": {"version": "83.0.4103", "type": "browser", "name": "Chrome"},
        "os": {"version": "10", "type": "os", "name": "Windows"},
        "trace": {
            "span_id": "83db1ad17e67dfe7",
            "type": "trace",
            "trace_id": "da6caabcd90e45fdb81f6655824a5f88",
            "op": "navigation",
        },
        "organization": {"type": "default", "id": "323938", "slug": "hellboy-meowmeow"},
    },
    "fingerprints": ["fbe908cc63d63ea9763fd84cb6bad177"],
    "context": {
        "resp": {
            "status": 403,
            "responseJSON": {"detail": "You do not have permission to perform this action."},
            "name": "ForbiddenError",
            "statusText": "Forbidden",
            "message": "GET /organizations/hellboy-meowmeow/users/ 403",
            "stack": "Error\n    at https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:480441\n    at u (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:165:51006)\n    at Generator._invoke (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:165:50794)\n    at Generator.A.forEach.e.<computed> [as next] (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:165:51429)\n    at n (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:16:68684)\n    at s (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:16:68895)\n    at https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:16:68954\n    at new Promise (<anonymous>)\n    at https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:16:68835\n    at v (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:480924)\n    at m (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:480152)\n    at t.fetchMemberList (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:902983)\n    at t.componentDidMount (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:900527)\n    at t.componentDidMount (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:189:15597)\n    at Pc (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:101023)\n    at t.unstable_runWithPriority (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:189:3462)\n    at Ko (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:45529)\n    at Rc (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:97371)\n    at Oc (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:87690)\n    at https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:45820\n    at t.unstable_runWithPriority (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:189:3462)\n    at Ko (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:45529)\n    at Zo (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:45765)\n    at Jo (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:45700)\n    at gc (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:84256)\n    at Object.enqueueSetState (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:181:50481)\n    at t.M.setState (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:173:1439)\n    at t.onUpdate (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:543076)\n    at a.n (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:119:149090)\n    at a.emit (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:189:6550)\n    at p.trigger (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:119:149379)\n    at p.onInitializeUrlState (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/app.js:1:541711)\n    at a.n (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:119:149090)\n    at a.emit (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:189:6550)\n    at Function.trigger (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:119:149379)\n    at https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:119:149484\n    at a (https://s1.sentry-cdn.com/_static/dde778f9f93a48e2b6e58ecb0c5eb8f2/sentry/dist/vendor.js:81:88800)",
        }
    },
    "release": {
        "dateReleased": datetime.fromisoformat("2020-06-17T19:21:02.186004Z"),
        "commitCount": 11,
        "url": "https://freight.getsentry.net/deploys/getsentry/production/8868/",
        "data": {},
        "lastDeploy": {
            "name": "b65bc521378269d3eaefdc964f8ef56621414943 to prod",
            "url": None,
            "environment": "prod",
            "dateStarted": None,
            "dateFinished": "2020-06-17T19:20:55.641748Z",
            "id": "6883490",
        },
        "deployCount": 1,
        "dateCreated": datetime.fromisoformat("2020-06-17T18:45:31.042157Z"),
        "version": "b65bc521378269d3eaefdc964f8ef56621414943",
        "lastCommit": {
            "repository": {
                "status": "active",
                "integrationId": "2933",
                "externalSlug": "getsentry/getsentry",
                "name": "getsentry/getsentry",
                "provider": {"id": "integrations:github", "name": "GitHub"},
                "url": "https://github.com/getsentry/getsentry",
                "id": "2",
                "dateCreated": "2016-10-10T21:36:45.373994Z",
            },
            "releases": [
                {
                    "dateReleased": datetime.fromisoformat("2020-06-23T13:26:18.427090Z"),
                    "url": "https://freight.getsentry.net/deploys/getsentry/staging/2077/",
                    "dateCreated": "2020-06-23T13:22:50.420265Z",
                    "version": "f3783e5fe710758724f14267439fd46cc2bf5918",
                    "shortVersion": "f3783e5fe710758724f14267439fd46cc2bf5918",
                    "ref": "perf/source-maps-test",
                },
                {
                    "dateReleased": datetime.fromisoformat("2020-06-17T19:21:02.186004Z"),
                    "url": "https://freight.getsentry.net/deploys/getsentry/production/8868/",
                    "dateCreated": datetime.fromisoformat("2020-06-17T18:45:31.042157Z"),
                    "version": "b65bc521378269d3eaefdc964f8ef56621414943",
                    "shortVersion": "b65bc521378269d3eaefdc964f8ef56621414943",
                    "ref": "master",
                },
            ],
            "dateCreated": datetime.fromisoformat("2020-06-17T18:43:37Z"),
            "message": "feat(billing): Get a lot of money",
            "id": "b65bc521378269d3eaefdc964f8ef56621414943",
        },
        "ref": "master",
    },
    "crashFile": None,
    "location": "example.py:123",
    "culprit": "/books/new/",
    "groupingConfig": {"enhancements": "abc", "id": "2359823092345612392"},
    "occurrence": None,
    "projectID": "5236886",
    "resolvedWith": [],
    "sdkUpdates": [],
    "userReport": None,
}


class EventExamples:
    PROJECT_EVENTS_SIMPLE = [
        OpenApiExample(
            "Return a list of error events bound to a project",
            value=[SIMPLE_EVENT],
            response_only=True,
            status_codes=["200"],
        )
    ]
    GROUP_EVENTS_SIMPLE = [
        OpenApiExample(
            "Return a list of error events bound to an issue",
            value=[SIMPLE_EVENT],
            response_only=True,
            status_codes=["200"],
        )
    ]
    GROUP_EVENT_DETAILS = [
        OpenApiExample(
            "Return an issue event",
            value=GROUP_EVENT,
            response_only=True,
            status_codes=["200"],
        )
    ]
