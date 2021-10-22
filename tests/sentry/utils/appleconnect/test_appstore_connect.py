import pytest
import requests
import responses as responses_mod

from sentry.utils.appleconnect import appstore_connect


@pytest.fixture
def responses():
    with responses_mod.RequestsMock() as r:
        yield r


def test_builds(responses, monkeypatch):
    responses.add(
        "GET",
        url=(
            "https://api.appstoreconnect.apple.com"
            "/v1/builds"
            "?filter[app]=1549832463"
            "&limit=200"
            "&include=appStoreVersion,preReleaseVersion,buildBundles"
            "&sort=-uploadedDate"
            "&filter[processingState]=VALID"
            "&filter[expired]=false"
        ),
        json={
            "data": [
                {
                    "attributes": {
                        "buildAudienceType": None,
                        "expirationDate": "2022-01-19T11:06:56-08:00",
                        "expired": False,
                        "iconAssetToken": {
                            "height": 167,
                            "templateUrl": "https://is1-ssl.mzstatic.com/image/thumb/Purple125/v4/c8/61/09/c86109d7-5006-13da-46e3-d0592791f070/Icon-83.5@2x.png.png/{w}x{h}bb.{f}",
                            "width": 167,
                        },
                        "lsMinimumSystemVersion": None,
                        "minMacOsVersion": "11.0",
                        "minOsVersion": "13.0",
                        "processingState": "VALID",
                        "uploadedDate": "2021-10-21T11:06:56-07:00",
                        "usesNonExemptEncryption": False,
                        "version": "496",
                    },
                    "id": "c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6",
                    "links": {
                        "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6"
                    },
                    "relationships": {
                        "app": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/app",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/app",
                            }
                        },
                        "appEncryptionDeclaration": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/appEncryptionDeclaration",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/appEncryptionDeclaration",
                            }
                        },
                        "appStoreVersion": {
                            "data": None,
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/appStoreVersion",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/appStoreVersion",
                            },
                        },
                        "betaAppReviewSubmission": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/betaAppReviewSubmission",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/betaAppReviewSubmission",
                            }
                        },
                        "betaBuildLocalizations": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/betaBuildLocalizations",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/betaBuildLocalizations",
                            }
                        },
                        "betaGroups": {
                            "links": {
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/betaGroups"
                            }
                        },
                        "buildBetaDetail": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/buildBetaDetail",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/buildBetaDetail",
                            }
                        },
                        "buildBundles": {
                            "data": [
                                {
                                    "id": "1e0bccfd-435c-426f-b808-2fa6f0a4c669",
                                    "type": "buildBundles",
                                }
                            ],
                            "meta": {"paging": {"limit": 10, "total": 1}},
                        },
                        "diagnosticSignatures": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/diagnosticSignatures",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/diagnosticSignatures",
                            }
                        },
                        "icons": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/icons",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/icons",
                            }
                        },
                        "individualTesters": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/individualTesters",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/individualTesters",
                            }
                        },
                        "perfPowerMetrics": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/perfPowerMetrics"
                            }
                        },
                        "preReleaseVersion": {
                            "data": {
                                "id": "dd7277f8-a686-404f-a4c8-a424ad9cdfeb",
                                "type": "preReleaseVersions",
                            },
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/preReleaseVersion",
                                "self": "https://api.appstoreconnect.apple.com/v1/builds/c8fe4057-5c12-45b2-a5e5-63ba5a26ebc6/relationships/preReleaseVersion",
                            },
                        },
                    },
                    "type": "builds",
                }
            ],
            "included": [
                {
                    "attributes": {"platform": "IOS", "version": "7.4.7"},
                    "id": "dd7277f8-a686-404f-a4c8-a424ad9cdfeb",
                    "links": {
                        "self": "https://api.appstoreconnect.apple.com/v1/preReleaseVersions/dd7277f8-a686-404f-a4c8-a424ad9cdfeb"
                    },
                    "relationships": {
                        "app": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/preReleaseVersions/dd7277f8-a686-404f-a4c8-a424ad9cdfeb/app",
                                "self": "https://api.appstoreconnect.apple.com/v1/preReleaseVersions/dd7277f8-a686-404f-a4c8-a424ad9cdfeb/relationships/app",
                            }
                        },
                        "builds": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/preReleaseVersions/dd7277f8-a686-404f-a4c8-a424ad9cdfeb/builds",
                                "self": "https://api.appstoreconnect.apple.com/v1/preReleaseVersions/dd7277f8-a686-404f-a4c8-a424ad9cdfeb/relationships/builds",
                            }
                        },
                    },
                    "type": "preReleaseVersions",
                },
                {
                    "attributes": {
                        "bundleId": "io.sentry.sample.iOS-Swift",
                        "bundleType": "APP",
                        "dSYMUrl": "http://iosapps.itunes.apple.com/itunes-assets/Purple126/v4/ee/c7/d1/eec7d1ef-5c42-5db8-c53f-5f2e12ed586c/appDsyms.zip?accessKey=1635111323_6541937231607596467_GytzzDTwJudm5GzcKXxzu%2ByO1e9gu%2F2%2FxSiQC4a3PMxk6qW540YpTeZmwgxFJqlspgLnwHJs27HQpaTA%2Fvhbrq2VLI1L%2FhMomqCc9RPy3eCa%2FgixG7VyyGlSbU1YXEhQZJWFzPq2KtWoUkSCmJ0wK0M76Lv1rCdzGpSkCN9rFk8%3D",
                        "deviceProtocols": [],
                        "entitlements": {
                            "iOS-Swift.app/iOS-Swift": {
                                "application-identifier": "97JCY7859U.io.sentry.sample.iOS-Swift",
                                "beta-reports-active": "true",
                                "com.apple.developer.team-identifier": "97JCY7859U",
                                "get-task-allow": "false",
                            }
                        },
                        "fileName": "7b762b899763f6084da878f90c9048ea226e64bacb0000ea56a49e09afb09165.ipa",
                        "hasOnDemandResources": False,
                        "hasPrerenderedIcon": True,
                        "hasSirikit": False,
                        "includesSymbols": False,
                        "isIosBuildMacAppStoreCompatible": True,
                        "locales": ["en"],
                        "platformBuild": "18E182",
                        "requiredCapabilities": ["arm64"],
                        "sdkBuild": "18E182",
                        "supportedArchitectures": ["arm64"],
                        "usesLocationServices": False,
                    },
                    "id": "1e0bccfd-435c-426f-b808-2fa6f0a4c669",
                    "links": {
                        "self": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669"
                    },
                    "relationships": {
                        "appClipDomainCacheStatus": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/appClipDomainCacheStatus",
                                "self": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/relationships/appClipDomainCacheStatus",
                            }
                        },
                        "appClipDomainDebugStatus": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/appClipDomainDebugStatus",
                                "self": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/relationships/appClipDomainDebugStatus",
                            }
                        },
                        "betaAppClipInvocations": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/betaAppClipInvocations",
                                "self": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/relationships/betaAppClipInvocations",
                            }
                        },
                        "buildBundleFileSizes": {
                            "links": {
                                "related": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/buildBundleFileSizes",
                                "self": "https://api.appstoreconnect.apple.com/v1/buildBundles/1e0bccfd-435c-426f-b808-2fa6f0a4c669/relationships/buildBundleFileSizes",
                            }
                        },
                    },
                    "type": "buildBundles",
                },
            ],
            "links": {
                "next": "https://api.appstoreconnect.apple.com/v1/builds?cursor=AQ.GXQEGw&include=preReleaseVersion%2CappStoreVersion%2CbuildBundles&filter%5Bexpired%5D=false&limit=1&sort=-uploadedDate&filter%5BprocessingState%5D=VALID&filter%5Bapp%5D=1549832463",
                "self": "https://api.appstoreconnect.apple.com/v1/builds?include=preReleaseVersion%2CappStoreVersion%2CbuildBundles&filter%5Bexpired%5D=false&limit=1&sort=-uploadedDate&filter%5BprocessingState%5D=VALID&filter%5Bapp%5D=1549832463",
            },
            "meta": {"paging": {"limit": 1, "total": 110}},
        },
    )

    monkeypatch.setattr(
        appstore_connect,
        "_get_authorization_header",
        lambda *a, **kw: {"Authorization": "Bearer abc"},
    )
    monkeypatch.setattr(appstore_connect, "_get_next_page", lambda *a, **kw: None)

    session = requests.Session()
    creds = appstore_connect.AppConnectCredentials(
        key_id="abc123", key="not-a-key", issuer_id="abc-123"
    )
    builds = appstore_connect.get_build_info(session, creds, "1549832463")
    assert builds
    print(builds)
    1 / 0
