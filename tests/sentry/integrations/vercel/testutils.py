from __future__ import absolute_import


EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE = """
    {
        "id": "uev_ZfbZKA3Ts2aEa2Cic6t6wSZx",
        "ownerId": "cstd1xKmLGVMed0z0f3SHlD2",
        "type": "deployment",
        "createdAt": 1592335604941,
        "payload": {
            "deploymentId": "dpl_2p92SueSKLagubfcRtheS3CvmcjK",
            "name": "nextjsblog-demo",
            "project": "nextjsblog-demo",
            "url": "nextjsblog-demo-gogovbsz1.vercel.app",
            "projectId": "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg",
            "plan": "hobby",
            "regions": ["sfo1"],
            "target": "production",
            "alias": ["nextjsblog-demo.now.sh","nextjsblog-demo.meredithanya.vercel.app","nextjsblog-demo-git-master.meredithanya.vercel.app","nextjsblog-demo.meredithanya.now.sh","nextjsblog-demo-git-master.meredithanya.now.sh"],
            "type": "LAMBDAS",
            "deployment": {
                "id": "dpl_2p92SueSKLagubfcRtheS3CvmcjK",
                "name": "nextjsblog-demo",
                "url": "nextjsblog-demo-gogovbsz1.vercel.app",
                "meta": {
                    "githubDeployment": "1",
                    "githubOrg": "MeredithAnya",
                    "githubRepo": "nextjsblog-demo",
                    "githubCommitOrg": "MeredithAnya",
                    "githubCommitRepo": "nextjsblog-demo",
                    "githubCommitRef": "master",
                    "githubCommitSha": "7488658dfcf24d9b735e015992b316e2a8340d9d",
                    "githubCommitMessage": "update index.js",
                    "githubCommitAuthorName": "MeredithAnya",
                    "githubCommitAuthorLogin": "MeredithAnya"
                }
            }
        },
        "region": "now-sfo",
        "teamId": null,
        "userId": "cstd1xKmLGVMed0z0f3SHlD2"
    }
"""

DEPLOYMENT_WEBHOOK_NO_COMMITS = """
    {
        "id": "uev_ZfbZKA3Ts2aEa2Cic6t6wSZx",
        "ownerId": "cstd1xKmLGVMed0z0f3SHlD2",
        "type": "deployment",
        "createdAt": 1592335604941,
        "payload": {
            "deploymentId": "dpl_2p92SueSKLagubfcRtheS3CvmcjK",
            "name": "nextjsblog-demo",
            "project": "nextjsblog-demo",
            "url": "nextjsblog-demo-gogovbsz1.vercel.app",
            "projectId": "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg",
            "plan": "hobby",
            "regions": ["sfo1"],
            "target": "production",
            "alias": ["nextjsblog-demo.now.sh","nextjsblog-demo.meredithanya.vercel.app","nextjsblog-demo-git-master.meredithanya.vercel.app","nextjsblog-demo.meredithanya.now.sh","nextjsblog-demo-git-master.meredithanya.now.sh"],
            "type": "LAMBDAS",
            "deployment": {
                "id": "dpl_2p92SueSKLagubfcRtheS3CvmcjK",
                "name": "nextjsblog-demo",
                "url": "nextjsblog-demo-gogovbsz1.vercel.app",
                "meta": {}
            }
        },
        "region": "now-sfo",
        "teamId": null,
        "userId": "cstd1xKmLGVMed0z0f3SHlD2"
    }
"""
