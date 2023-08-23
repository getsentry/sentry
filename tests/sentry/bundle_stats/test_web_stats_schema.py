from sentry.bundle_stats.web_stats_schema import WebStats
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

SAMPLE_WEB_STATS = """
{
  "hash": "ef089ec0091cddb4e0f2",
    "assets": [
    {
      "name": "chunks/vendors-node_modules_emotion_is-prop-valid_dist_is-prop-valid_browser_esm_js-node_modules_emo-d1e938.79b52c6063abf3d49215.js",
      "size": 8310770
    },
    {
      "name": "chunks/app_bootstrap_initializeApp_tsx.19bbe23be5e3d38d103c.js",
      "size": 1942081
    },
    {
      "name": "chunks/app_bootstrap_commonInitialization_tsx-app_bootstrap_initializeSdk_tsx-app_bootstrap_renderOn-7a5cae.e0e9434d807d13a60905.js",
      "size": 1612789
    }
  ],
  "chunks": [
    {
      "entry": false,
      "id": "PasswordStrength",
      "size": 24403,
      "initial": false,
      "files": [
        "chunks/PasswordStrength.7692431d39e119063c87.js"
      ],
      "names": [
        "PasswordStrength"
      ]
    },
    {
      "entry": false,
      "id": "SetupWizard",
      "size": 11067,
      "initial": false,
      "files": [
        "chunks/SetupWizard.80eb6ed22c6329bcf4a7.js"
      ],
      "names": [
        "SetupWizard"
      ]
    },
    {
      "entry": false,
      "id": "SuperuserAccessForm",
      "size": 25017,
      "initial": false,
      "files": [
        "chunks/SuperuserAccessForm.2f6f6eb8e086c3766db6.js"
      ],
      "names": [
        "SuperuserAccessForm"
      ]
    },
    {
      "entry": false,
      "id": "U2fSign",
      "size": 13951,
      "initial": false,
      "files": [
        "chunks/U2fSign.28743f40705c13acd224.js"
      ],
      "names": [
        "U2fSign"
      ]
    },
    {
      "entry": false,
      "id": "_71ff-_0699-_1357-_d941-_94ca-_3018",
      "size": 90,
      "initial": false,
      "files": [
        "chunks/_71ff-_0699-_1357-_d941-_94ca-_3018.670f996b2272da318080.js"
      ],
      "names": []
    },
    {
      "entry": true,
      "id": "app",
      "size": 75418,
      "initial": true,
      "files": [
        "entrypoints/app.js"
      ],
      "names": [
        "app"
      ]
    },
    {
      "entry": false,
      "id": "app_actionCreators_events_tsx-app_views_profiling_profileSummary_index_tsx",
      "size": 42889,
      "initial": false,
      "files": [
        "chunks/app_actionCreators_events_tsx-app_views_profiling_profileSummary_index_tsx.4104b272c1080dd4a296.js"
      ],
      "names": []
    },
    {
      "entry": false,
      "id": "app_actionCreators_navigation_tsx-app_utils_useParams_tsx-app_utils_withOrganizations_tsx",
      "size": 108575,
      "initial": false,
      "files": [
        "chunks/app_actionCreators_navigation_tsx-app_utils_useParams_tsx-app_utils_withOrganizations_tsx.ea724cdd767680907bc7.js"
      ],
      "names": []
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

        assert obj["hash"] == stats_as_dict["hash"] == "ef089ec0091cddb4e0f2"
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
