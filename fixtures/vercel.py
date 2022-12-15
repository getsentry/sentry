SIGNATURE = "74b587857986545361e8a4253b74cd6224d34869"
SIGNATURE_NEW = "cecad6333f8652af7d4e9c7b6ad87f1c922a76d3"
SECRET = "AiK52QASLJXmCXX3X9gO2Zyh"

# Old Vercel response
EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD = """
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

# New Vercel response
EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_NEW = """
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

MINIMAL_WEBHOOK = """
    {
        "type": "deployment",
        "payload": {
            "project": "nextjsblog-demo",
            "url": "nextjsblog-demo-gogovbsz1.vercel.app",
            "projectId": "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg",
            "target": "production",
            "deployment": {
                "meta": {
                    "githubCommitSha": "7488658dfcf24d9b735e015992b316e2a8340d9d"
                }
            }
        },
        "userId": "cstd1xKmLGVMed0z0f3SHlD2"
    }
"""
