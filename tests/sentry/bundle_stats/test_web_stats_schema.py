from sentry.bundle_stats.web_stats_schema import WebStats
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

SAMPLE_WEB_STATS = """
{
  "version": "5.87.0",
  "hash": "6ce07ad35952880f53b7",
  "entrypoints": {
    "app": {
      "name": "app",
      "chunks": [
        "app"
      ],
      "assets": [
        {
          "name": "entrypoints/app.js"
        }
      ],
      "filteredAssets": 0,
      "assetsSize": null,
      "auxiliaryAssets": [],
      "filteredAuxiliaryAssets": 0,
      "auxiliaryAssetsSize": 0,
      "children": {},
      "childAssets": {},
      "isOverSizeLimit": false
    },
    "pipeline": {
      "name": "pipeline",
      "chunks": [
        "pipeline"
      ],
      "assets": [
        {
          "name": "entrypoints/pipeline.js"
        }
      ],
      "filteredAssets": 0,
      "assetsSize": null,
      "auxiliaryAssets": [],
      "filteredAuxiliaryAssets": 0,
      "auxiliaryAssetsSize": 0,
      "children": {},
      "childAssets": {},
      "isOverSizeLimit": false
    },
    "sentry": {
      "name": "sentry",
      "chunks": [
        "sentry"
      ],
      "assets": [
        {
          "name": "entrypoints/sentry.css"
        }
      ],
      "filteredAssets": 0,
      "assetsSize": null,
      "auxiliaryAssets": [
        {
          "name": "assets/ai-loader.82039e88d11503e81e09.gif"
        },
        {
          "name": "assets/ai-suggestion-wheel-of-fortune.ac7ab7ac9b402ab5a461.gif"
        },
        {
          "name": "assets/roboto-mono-medium-cyrillic-ext.6e9b3f4b381b65025e93.woff"
        },
        {
          "name": "assets/roboto-mono-medium-cyrillic.5ffebcbf760bf04dc301.woff"
        },
        {
          "name": "assets/roboto-mono-medium-latin-ext.3f875dedeaf2d0c5b66e.woff"
        },
        {
          "name": "assets/roboto-mono-medium.16c6e505ff8c0eabf3fb.woff"
        },
        {
          "name": "assets/roboto-mono-regular-cyrillic-ext.3cfc40991b264e7977cd.woff"
        },
        {
          "name": "assets/roboto-mono-regular-cyrillic.b92b2a43200ea504cda9.woff"
        },
        {
          "name": "assets/roboto-mono-regular-latin-ext.79812ac41fcc330f6976.woff"
        },
        {
          "name": "assets/roboto-mono-regular.706c56e3365fe3c803a7.woff"
        },
        {
          "name": "assets/rubik-medium-cyrillic-ext.03002f9ecb0f91cab4a2.woff"
        },
        {
          "name": "assets/rubik-medium-cyrillic.993ca8017ca056b699e2.woff"
        },
        {
          "name": "assets/rubik-medium-latin-ext.553ee0aeed854f3310a6.woff"
        },
        {
          "name": "assets/rubik-medium.c9da53ef4973605ec234.woff"
        },
        {
          "name": "assets/rubik-regular-cyrillic-ext.636b6eda792b9e7d6c7e.woff"
        },
        {
          "name": "assets/rubik-regular-cyrillic.f7afc0559b1e925e16b2.woff"
        },
        {
          "name": "assets/rubik-regular-latin-ext.96cb3b02d1c01c484a25.woff"
        },
        {
          "name": "assets/rubik-regular.ac2d143aa7c4dc5fb505.woff"
        },
        {
          "name": "assets/sentry-avatar.4e3866d94215522d5507.png"
        },
        {
          "name": "assets/sentry-pattern.dba661a9db73aaaf2ea0.png"
        },
        {
          "name": "assets/sentry-simple.36e8bca3aaf2d33451ec.svg"
        },
        {
          "name": "assets/sentry-simple.560778129eda82ce960f.woff"
        },
        {
          "name": "assets/sentry-simple.5d16284b609daf5f5742.eot"
        },
        {
          "name": "assets/sentry-simple.f86977eb2e422d8dd637.ttf"
        },
        {
          "name": "assets/u2f-small.38c660bd2d48ff336e9a.gif"
        }
      ],
      "filteredAuxiliaryAssets": 0,
      "auxiliaryAssetsSize": null,
      "children": {},
      "childAssets": {},
      "isOverSizeLimit": false
    }
  },
  "assetsByChunkName": {
    "app": [
      "entrypoints/app.js"
    ],
    "pipeline": [
      "entrypoints/pipeline.js"
    ],
    "sentry": [
      "entrypoints/sentry.css"
    ],
    "SetupWizard": [
      "chunks/SetupWizard.48d64c87dae770542652.js"
    ],
    "U2fSign": [
      "chunks/U2fSign.9fa7f12a302fe02feed0.js"
    ],
    "SuperuserAccessForm": [
      "chunks/SuperuserAccessForm.da7fa3ebd6c787507566.js"
    ],
    "PasswordStrength": [
      "chunks/PasswordStrength.95222950fe1e5ec25189.js"
    ],
    "locale/ru": [
      "chunks/locale/ru.6c0aed1c50194e535e5e.js"
    ],
    "locale/ja": [
      "chunks/locale/ja.97e3f29a79c68835c59e.js"
    ],
    "locale/cs": [
      "chunks/locale/cs.10063f9f485fb19149d5.js"
    ],
    "locale/zh-cn": [
      "chunks/locale/zh-cn.6b9fe566f3a96e24c386.js"
    ],
    "locale/fr": [
      "chunks/locale/fr.1edf7ed091677a8e2e15.js"
    ],
    "locale/es": [
      "chunks/locale/es.bc7db45a8999c71326b2.js"
    ],
    "locale/de": [
      "chunks/locale/de.650403e0a825a64fcee6.js"
    ],
    "locale/pt-br": [
      "chunks/locale/pt-br.26075e35e9fc8cc4d5bf.js"
    ],
    "locale/bg": [
      "chunks/locale/bg.29533e96b42d5d5d6734.js"
    ],
    "locale/hu": [
      "chunks/locale/hu.8b51c04c8d097805bb94.js"
    ],
    "locale/zh-tw": [
      "chunks/locale/zh-tw.1acf705108b3276313dc.js"
    ],
    "locale/it": [
      "chunks/locale/it.eb1cf534021bd9cd8d3f.js"
    ],
    "locale/tr": [
      "chunks/locale/tr.cdad9130a6d886789f15.js"
    ],
    "locale/uk": [
      "chunks/locale/uk.d6721b1176adef9be7c6.js"
    ],
    "locale/sk": [
      "chunks/locale/sk.b5af0ae644799626011e.js"
    ],
    "locale/et": [
      "chunks/locale/et.946f8f0553db20082636.js"
    ],
    "locale/pl": [
      "chunks/locale/pl.b347e4014a0ace3566d7.js"
    ],
    "locale/sl": [
      "chunks/locale/sl.f72a2b3c9ad41a5bd5b7.js"
    ],
    "locale/hi": [
      "chunks/locale/hi.e4ecb64f15c8de955187.js"
    ],
    "locale/ar": [
      "chunks/locale/ar.7c023f7629f17ae15d16.js"
    ],
    "locale/fi": [
      "chunks/locale/fi.fb035b597cd007b41c8d.js"
    ],
    "locale/lv": [
      "chunks/locale/lv.aac0e53ed23077e9f32b.js"
    ],
    "locale/ko": [
      "chunks/locale/ko.a817e8e560a2446b3f22.js"
    ],
    "locale/pt": [
      "chunks/locale/pt.0648c1cccc5111d14b64.js"
    ],
    "locale/gl": [
      "chunks/locale/gl.f2f165199e12b604d9ae.js"
    ],
    "locale/lt": [
      "chunks/locale/lt.cb9fc85b99b93407df79.js"
    ],
    "locale/el": [
      "chunks/locale/el.f4c176544156c2ea7f52.js"
    ],
    "locale/ca": [
      "chunks/locale/ca.523fefdb8481f0b8695c.js"
    ],
    "locale/fa": [
      "chunks/locale/fa.5142a864956f5c289a1b.js"
    ],
    "locale/he": [
      "chunks/locale/he.efa904f9d1cc7f2af512.js"
    ],
    "locale/af": [
      "chunks/locale/af.ff7065241a7b25aef5a2.js"
    ],
    "locale/da": [
      "chunks/locale/da.e6054815e914fb57c523.js"
    ],
    "locale/id": [
      "chunks/locale/id.07853d07353b492488d1.js"
    ],
    "locale/th": [
      "chunks/locale/th.4f1dc8a82059fa8f16f8.js"
    ],
    "locale/ro": [
      "chunks/locale/ro.63f909d4bbe1712051be.js"
    ],
    "locale/vi": [
      "chunks/locale/vi.5b8b2c840e90b9f16214.js"
    ],
    "locale/sv-se": [
      "chunks/locale/sv-se.d406e9c7c72b12b8d9a7.js"
    ],
    "locale/ru-ru": [
      "chunks/locale/ru-ru.1648d3ce6e350b7b0c9a.js"
    ],
    "locale/ro-ro": [
      "chunks/locale/ro-ro.6fbbb7af5ae1f5ac91c8.js"
    ],
    "locale/pl-pl": [
      "chunks/locale/pl-pl.36c60059720f863c8ff8.js"
    ],
    "locale/no": [
      "chunks/locale/no.9b0ee4e93e534b3baa1e.js"
    ],
    "locale/nl-nl": [
      "chunks/locale/nl-nl.0065b562a80cc4dc844a.js"
    ],
    "locale/ach": [
      "chunks/locale/ach.975854b27e38a43262e8.js"
    ]
  },
  "assets": [
    {
      "name": "chunks/vendors-node_modules_emotion_is-prop-valid_dist_is-prop-valid_browser_esm_js-node_modules_emo-d1e938.03be4ac55d84aced3645.js",
      "size": 20602299,
      "info": {
        "immutable": true,
        "contenthash": "03be4ac55d84aced3645",
        "javascriptModule": false
      },
      "chunks": [
        "vendors-node_modules_emotion_is-prop-valid_dist_is-prop-valid_browser_esm_js-node_modules_emo-d1e938"
      ]
    },
    {
      "name": "chunks/app_bootstrap_initializeApp_tsx.1a6020abb7a28b4047b6.js",
      "size": 10605560,
      "info": {
        "immutable": true,
        "contenthash": "1a6020abb7a28b4047b6",
        "javascriptModule": false
      },
      "chunks": [
        "app_bootstrap_initializeApp_tsx"
      ]
    },
    {
      "name": "chunks/app_components_searchSyntax_parser_tsx-app_components_searchSyntax_utils_tsx-app_utils_withPa-6958cd.d2fe40b88c3150317d3c.js",
      "size": 6882495,
      "info": {
        "immutable": true,
        "contenthash": "d2fe40b88c3150317d3c",
        "javascriptModule": false
      },
      "chunks": [
        "app_components_searchSyntax_parser_tsx-app_components_searchSyntax_utils_tsx-app_utils_withPa-6958cd"
      ]
    },
    {
      "name": "chunks/app_bootstrap_commonInitialization_tsx-app_bootstrap_initializeSdk_tsx-app_bootstrap_renderOn-7a5cae.f9550eb6f7905bfe25c4.js",
      "size": 4821938,
      "info": {
        "immutable": true,
        "contenthash": "f9550eb6f7905bfe25c4",
        "javascriptModule": false
      },
      "chunks": [
        "app_bootstrap_commonInitialization_tsx-app_bootstrap_initializeSdk_tsx-app_bootstrap_renderOn-7a5cae"
      ]
    },
    {
      "name": "chunks/app_components_alertLink_tsx-app_components_events_contexts_index_tsx-app_components_events_d-448966.3bbc3c771fd9a4bbd148.js",
      "size": 3197592,
      "info": {
        "immutable": true,
        "contenthash": "3bbc3c771fd9a4bbd148",
        "javascriptModule": false
      },
      "chunks": [
        "app_components_alertLink_tsx-app_components_events_contexts_index_tsx-app_components_events_d-448966"
      ]
    }
  ],
  "chunks": [
    {
      "entry": false,
      "id": "PasswordStrength",
      "size": 24780,
      "initial": false,
      "files": [
        "chunks/PasswordStrength.95222950fe1e5ec25189.js"
      ],
      "names": [
        "PasswordStrength"
      ],
      "modules": [
        {
          "name": "./app/components/passwordStrength.tsx",
          "size": 24780,
          "id": "./app/components/passwordStrength.tsx",
          "identifier": "/Users/vbro/getsentry/hack23/sentry/node_modules/babel-loader/lib/index.js??ruleSet[1].rules[0].use!/Users/vbro/getsentry/hack23/sentry/static/app/components/passwordStrength.tsx",
          "chunks": [
            "PasswordStrength"
          ],
          "assets": []
        }
      ]
    },
    {
      "entry": false,
      "id": "SetupWizard",
      "size": 11375,
      "initial": false,
      "files": [
        "chunks/SetupWizard.48d64c87dae770542652.js"
      ],
      "names": [
        "SetupWizard"
      ],
      "modules": [
        {
          "name": "./app/views/setupWizard/index.tsx",
          "size": 11375,
          "id": "./app/views/setupWizard/index.tsx",
          "identifier": "/Users/vbro/getsentry/hack23/sentry/node_modules/babel-loader/lib/index.js??ruleSet[1].rules[0].use!/Users/vbro/getsentry/hack23/sentry/static/app/views/setupWizard/index.tsx",
          "chunks": [
            "SetupWizard"
          ],
          "assets": []
        }
      ]
    },
    {
      "entry": false,
      "id": "SuperuserAccessForm",
      "size": 25141,
      "initial": false,
      "files": [
        "chunks/SuperuserAccessForm.da7fa3ebd6c787507566.js"
      ],
      "names": [
        "SuperuserAccessForm"
      ],
      "modules": [
        {
          "name": "./app/components/superuserAccessForm.tsx",
          "size": 23862,
          "id": "./app/components/superuserAccessForm.tsx",
          "identifier": "/Users/vbro/getsentry/hack23/sentry/node_modules/babel-loader/lib/index.js??ruleSet[1].rules[0].use!/Users/vbro/getsentry/hack23/sentry/static/app/components/superuserAccessForm.tsx",
          "chunks": [
            "SuperuserAccessForm"
          ],
          "assets": []
        },
        {
          "name": "./app/components/u2f/u2fContainer.tsx",
          "size": 660,
          "id": "./app/components/u2f/u2fContainer.tsx",
          "identifier": "/Users/vbro/getsentry/hack23/sentry/node_modules/babel-loader/lib/index.js??ruleSet[1].rules[0].use!/Users/vbro/getsentry/hack23/sentry/static/app/components/u2f/u2fContainer.tsx",
          "chunks": [
            "SuperuserAccessForm",
            "app_components_modals_sudoModal_tsx-node_modules_core-js_internals_define-built-in-accessor_js"
          ],
          "assets": []
        },
        {
          "name": "./app/constants/superuserAccessErrors.tsx",
          "size": 619,
          "id": "./app/constants/superuserAccessErrors.tsx",
          "identifier": "/Users/vbro/getsentry/hack23/sentry/node_modules/babel-loader/lib/index.js??ruleSet[1].rules[0].use!/Users/vbro/getsentry/hack23/sentry/static/app/constants/superuserAccessErrors.tsx",
          "chunks": [
            "SuperuserAccessForm",
            "app_components_modals_sudoModal_tsx-node_modules_core-js_internals_define-built-in-accessor_js"
          ],
          "assets": []
        }
      ]
    }
  ],
  "modules": [
    {
      "name": "./app/utils/statics-setup.tsx",
      "size": 896,
      "moduleType": "javascript/auto",
      "chunks": [
        "app",
        "pipeline"
      ]
    },
    {
      "name": "./app/index.tsx",
      "size": 3321,
      "moduleType": "javascript/auto",
      "chunks": [
        "app"
      ]
    },
    {
      "name": "./app/views/integrationPipeline/index.tsx",
      "size": 122,
      "moduleType": "javascript/auto",
      "chunks": [
        "pipeline"
      ]
    },
    {
      "name": "./less/sentry.less",
      "size": 50,
      "moduleType": "javascript/auto",
      "chunks": [
        "sentry"
      ]
    },
    {
      "name": "css ../node_modules/css-loader/dist/cjs.js!../node_modules/less-loader/dist/cjs.js!./less/sentry.less",
      "size": 160050,
      "moduleType": "css/mini-extract",
      "chunks": [
        "sentry"
      ]
    }
  ]
}
"""


@region_silo_test(stable=True)
class WebStatsSchemaTest(TestCase):
    def test_parse_sample(self):
        obj = json.loads(SAMPLE_WEB_STATS)
        web_stats = WebStats.parse(obj)
        stats_as_dict = web_stats.as_dict()

        assert obj["hash"] == stats_as_dict["hash"] == "6ce07ad35952880f53b7"
        assert len(obj["assets"]) == len(stats_as_dict["assets"])
        assert len(obj["chunks"]) == len(stats_as_dict["chunks"])
        assert len(obj["modules"]) == len(stats_as_dict["modules"])

        obj_asset0 = obj["assets"][0]
        stats_asset0 = stats_as_dict["assets"][0]
        assert obj_asset0["name"] == stats_asset0["name"]
        assert obj_asset0["size"] == stats_asset0["size"]

        obj_chunk1 = obj["chunks"][1]
        stats_chunk1 = stats_as_dict["chunks"][1]
        assert obj_chunk1["entry"] == stats_chunk1["entry"]
        assert obj_chunk1["id"] == stats_chunk1["id"]
        assert obj_chunk1["size"] == stats_chunk1["size"]
        assert obj_chunk1["files"] == stats_chunk1["files"]
        assert obj_chunk1["names"] == stats_chunk1["names"]

        obj_module2 = obj["modules"][2]
        stats_module2 = stats_as_dict["modules"][2]
        assert obj_module2["name"] == stats_module2["name"]
        assert obj_module2["size"] == stats_module2["size"]
        assert obj_module2["moduleType"] == stats_module2["moduleType"]
