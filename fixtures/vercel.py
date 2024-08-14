SIGNATURE = "cecad6333f8652af7d4e9c7b6ad87f1c922a76d3"
SECRET = "AiK52QASLJXmCXX3X9gO2Zyh"

EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE = """
    {
        "id": "uev_ZfbZKA3Ts2aEa2Cic6t6wSZ3",
        "type": "deployment.created",
        "createdAt": 1592335604941,
        "payload": {
            "project": {
                "id": "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg"
            },
            "url": "nextjsblog-demo-new-gogovbsz1.vercel.app",
            "plan": "hobby",
            "target": "production",
            "links": {
                "deployment": "https://vercel.com/nextjsblog-demo-new/dpl_2p92SueSKLagubfcRtheS3Cvmcj3",
                "project": "https://vercel.com/nextjsblog-demo-new"
            },
            "alias": ["nextjsblog-demo-new.now.sh","nextjsblog-demo-new.meredithanya.vercel.app","nextjsblog-demo-new-git-master.meredithanya.vercel.app","nextjsblog-demo-new.meredithanya.now.sh","nextjsblog-demo-new-git-master.meredithanya.now.sh"],
            "type": "LAMBDAS",
            "regions": ["now-sfo"],
            "deployment": {
                "id": "dpl_2p92SueSKLagubfcRtheS3Cvmcj3",
                "name": "nextjsblog-demo-new",
                "url": "nextjsblog-demo-new-gogovbsz1.vercel.app",
                "meta": {
                    "githubDeployment": "2",
                    "githubOrg": "MeredithAnya",
                    "githubRepo": "nextjsblog-demo-new",
                    "githubCommitOrg": "MeredithAnya",
                    "githubCommitRepo": "nextjsblog-demo-new",
                    "githubCommitRef": "master",
                    "githubCommitSha": "7488658dfcf24d9b735e015992b316e2a8340d93",
                    "githubCommitMessage": "update index.js",
                    "githubCommitAuthorName": "MeredithAnya",
                    "githubCommitAuthorLogin": "MeredithAnya"
                }
            },
            "user": {
                "id": "cstd1xKmLGVMed0z0f3SHlD2"
            },
            "team": null
        }
    }
"""

DEPLOYMENT_WEBHOOK_NO_COMMITS = """
    {
        "id": "uev_ZfbZKA3Ts2aEa2Cic6t6wSZ3",
        "type": "deployment.created",
        "createdAt": 1592335604941,
        "payload": {
            "project": {
                "id": "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg"
            },
            "url": "nextjsblog-demo-new-gogovbsz1.vercel.app",
            "plan": "hobby",
            "target": "production",
            "links": {
                "deployment": "https://vercel.com/nextjsblog-demo-new/dpl_2p92SueSKLagubfcRtheS3Cvmcj3",
                "project": "https://vercel.com/nextjsblog-demo-new"
            },
            "alias": ["nextjsblog-demo-new.now.sh","nextjsblog-demo-new.meredithanya.vercel.app","nextjsblog-demo-new-git-master.meredithanya.vercel.app","nextjsblog-demo-new.meredithanya.now.sh","nextjsblog-demo-new-git-master.meredithanya.now.sh"],
            "type": "LAMBDAS",
            "regions": ["now-sfo"],
            "deployment": {
                "id": "dpl_2p92SueSKLagubfcRtheS3Cvmcj3",
                "name": "nextjsblog-demo-new",
                "url": "nextjsblog-demo-new-gogovbsz1.vercel.app",
                "meta": {}
            },
            "user": {
                "id": "cstd1xKmLGVMed0z0f3SHlD2"
            },
            "team": null
        }
    }
"""

MINIMAL_WEBHOOK = """
    {
        "type": "deployment.created",
        "payload": {
            "project": "nextjsblog-demo",
            "url": "nextjsblog-demo-gogovbsz1.vercel.app",
            "projectId": "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg",
            "target": "production",
            "deployment": {
                "meta": {
                    "githubCommitSha": "7488658dfcf24d9b735e015992b316e2a8340d9d"
                }
            },
            "user": {
                "id": "cstd1xKmLGVMed0z0f3SHlD2"
            }
        }
    }
"""
