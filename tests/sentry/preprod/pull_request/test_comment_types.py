from typing import int
from sentry.preprod.pull_request.comment_types import (
    AuthorAssociation,
    IssueComment,
    ReviewComment,
    ReviewCommentSide,
)


class TestPullRequestCommentTypes:
    def test_parse_github_issue_comments_real_data(self):
        """Test parsing real GitHub issue comments from actual PR data."""
        raw_comments = [
            {
                "url": "https://api.github.com/repos/test-org/test-repo/issues/comments/1111111111",
                "html_url": "https://github.com/test-org/test-repo/pull/123#issuecomment-1111111111",
                "issue_url": "https://api.github.com/repos/test-org/test-repo/issues/123",
                "id": 1111111111,
                "node_id": "IC_kwDOKLDwMM7Bdug5",
                "user": {
                    "login": "test-bot[bot]",
                    "id": 11111111,
                    "node_id": "MDM6Qm90NzU4NjQ3MjI=",
                    "avatar_url": "https://avatars.githubusercontent.com/in/12345?v=4",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/test-bot%5Bbot%5D",
                    "html_url": "https://github.com/apps/test-bot",
                    "followers_url": "https://api.github.com/users/test-bot%5Bbot%5D/followers",
                    "following_url": "https://api.github.com/users/test-bot%5Bbot%5D/following{/other_user}",
                    "gists_url": "https://api.github.com/users/test-bot%5Bbot%5D/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/test-bot%5Bbot%5D/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/test-bot%5Bbot%5D/subscriptions",
                    "organizations_url": "https://api.github.com/users/test-bot%5Bbot%5D/orgs",
                    "repos_url": "https://api.github.com/users/test-bot%5Bbot%5D/repos",
                    "events_url": "https://api.github.com/users/test-bot%5Bbot%5D/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/test-bot%5Bbot%5D/received_events",
                    "type": "Bot",
                    "user_view_type": "public",
                    "site_admin": False,
                },
                "created_at": "2025-09-02T15:20:38Z",
                "updated_at": "2025-09-02T15:21:23Z",
                "body": '# 📸 Snapshot Test \n## Base build not found\nNo build was found for the base commit <a href="https://www.github.com/test-org/test-repo/commit/abc123def456?utm_source=github&utm_medium=vcs" target="_blank" rel="noreferrer noopener">abc123d</a>. This is required to generate a snapshot diff for your pull request.\n\nIt\'s possible that you created a branch off the base commit before all of the CI steps have finished processing, e.g. the one that uploads a build to our system. If that\'s the case, no problem! Just wait and this will eventually resolve.\n\n---\n\n:flying_saucer: Powered by <a href="https://www.example.com/?utm_source=github&utm_medium=vcs" target="_blank" rel="noreferrer noopener">Example Tools</a>',
                "author_association": "NONE",
                "reactions": {
                    "url": "https://api.github.com/repos/test-org/test-repo/issues/comments/1111111111/reactions",
                    "total_count": 0,
                    "+1": 0,
                    "-1": 0,
                    "laugh": 0,
                    "hooray": 0,
                    "confused": 0,
                    "heart": 0,
                    "rocket": 0,
                    "eyes": 0,
                },
                "performed_via_github_app": {
                    "id": 12345,
                    "client_id": "Iv1.aaaabbbbccccdddd",
                    "slug": "test-bot",
                    "node_id": "MDM6QXBwOTI0NjU=",
                    "owner": {
                        "login": "TestOrg",
                        "id": 22222222,
                        "node_id": "MDEyOk9yZ2FuaXphdGlvbjc0MDMzNDg2",
                        "avatar_url": "https://avatars.githubusercontent.com/u/22222222?v=4",
                        "gravatar_id": "",
                        "url": "https://api.github.com/users/TestOrg",
                        "html_url": "https://github.com/TestOrg",
                        "followers_url": "https://api.github.com/users/TestOrg/followers",
                        "following_url": "https://api.github.com/users/TestOrg/following{/other_user}",
                        "gists_url": "https://api.github.com/users/TestOrg/gists{/gist_id}",
                        "starred_url": "https://api.github.com/users/TestOrg/starred{/owner}{/repo}",
                        "subscriptions_url": "https://api.github.com/users/TestOrg/subscriptions",
                        "organizations_url": "https://api.github.com/users/TestOrg/orgs",
                        "repos_url": "https://api.github.com/users/TestOrg/repos",
                        "events_url": "https://api.github.com/users/TestOrg/events{/privacy}",
                        "received_events_url": "https://api.github.com/users/TestOrg/received_events",
                        "type": "Organization",
                        "user_view_type": "public",
                        "site_admin": False,
                    },
                    "name": "Test Bot",
                    "description": "Test bot for continuous integration",
                    "external_url": "https://www.example.com/",
                    "html_url": "https://github.com/apps/test-bot",
                    "created_at": "2020-12-11T22:38:09Z",
                    "updated_at": "2022-04-19T03:13:33Z",
                    "permissions": {
                        "checks": "write",
                        "metadata": "read",
                        "pull_requests": "write",
                    },
                    "events": ["pull_request"],
                },
            },
            {
                "url": "https://api.github.com/repos/test-org/test-repo/issues/comments/2222222222",
                "html_url": "https://github.com/test-org/test-repo/pull/123#issuecomment-2222222222",
                "issue_url": "https://api.github.com/repos/test-org/test-repo/issues/123",
                "id": 2222222222,
                "node_id": "IC_kwDOKLDwMM7BePlk",
                "user": {
                    "login": "testuser",
                    "id": 33333333,
                    "node_id": "MDQ6VXNlcjMzMjU5Nw==",
                    "avatar_url": "https://avatars.githubusercontent.com/u/33333333?v=4",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/testuser",
                    "html_url": "https://github.com/testuser",
                    "followers_url": "https://api.github.com/users/testuser/followers",
                    "following_url": "https://api.github.com/users/testuser/following{/other_user}",
                    "gists_url": "https://api.github.com/users/testuser/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/testuser/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/testuser/subscriptions",
                    "organizations_url": "https://api.github.com/users/testuser/orgs",
                    "repos_url": "https://api.github.com/users/testuser/repos",
                    "events_url": "https://api.github.com/users/testuser/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/testuser/received_events",
                    "type": "User",
                    "user_view_type": "public",
                    "site_admin": False,
                },
                "created_at": "2025-09-02T15:58:45Z",
                "updated_at": "2025-09-02T15:58:45Z",
                "body": "This seems to be working but the size and snapshots are just broken on main.",
                "author_association": "MEMBER",
                "reactions": {
                    "url": "https://api.github.com/repos/test-org/test-repo/issues/comments/2222222222/reactions",
                    "total_count": 0,
                    "+1": 0,
                    "-1": 0,
                    "laugh": 0,
                    "hooray": 0,
                    "confused": 0,
                    "heart": 0,
                    "rocket": 0,
                    "eyes": 0,
                },
                "performed_via_github_app": None,
            },
        ]

        comment1 = IssueComment.parse_obj(raw_comments[0])
        assert isinstance(comment1, IssueComment)
        assert comment1.id == 1111111111
        assert comment1.user is not None
        assert comment1.user.login == "test-bot[bot]"
        assert comment1.user.type == "Bot"
        assert "Snapshot Test" in comment1.body
        assert comment1.author_association == AuthorAssociation.NONE
        assert comment1.reactions is not None
        assert comment1.reactions.total_count == 0

        comment2 = IssueComment.parse_obj(raw_comments[1])
        assert isinstance(comment2, IssueComment)
        assert comment2.id == 2222222222
        assert comment2.user is not None
        assert comment2.user.login == "testuser"
        assert comment2.user.type == "User"
        assert (
            comment2.body
            == "This seems to be working but the size and snapshots are just broken on main."
        )
        assert comment2.author_association == AuthorAssociation.MEMBER

    def test_parse_github_review_comments_real_data(self):
        """Test parsing real GitHub review comments from test-org/test-repo PR."""
        raw_comments = [
            {
                "url": "https://api.github.com/repos/test-org/test-repo/pulls/comments/4444444444",
                "pull_request_review_id": 5555555555,
                "id": 4444444444,
                "node_id": "PRRC_kwDOKLDwMM6KE1-e",
                "diff_hunk": "@@ -1,3 +1,11 @@\n+GIT",
                "path": "ios/Gemfile.lock",
                "commit_id": "abc123def456789",
                "original_commit_id": "abc123def456789",
                "user": {
                    "login": "reviewer1",
                    "id": 44444444,
                    "node_id": "MDQ6VXNlcjE0NDc3OTg=",
                    "avatar_url": "https://avatars.githubusercontent.com/u/44444444?v=4",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/reviewer1",
                    "html_url": "https://github.com/reviewer1",
                    "followers_url": "https://api.github.com/users/reviewer1/followers",
                    "following_url": "https://api.github.com/users/reviewer1/following{/other_user}",
                    "gists_url": "https://api.github.com/users/reviewer1/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/reviewer1/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/reviewer1/subscriptions",
                    "organizations_url": "https://api.github.com/users/reviewer1/orgs",
                    "repos_url": "https://api.github.com/users/reviewer1/repos",
                    "events_url": "https://api.github.com/users/reviewer1/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/reviewer1/received_events",
                    "type": "User",
                    "user_view_type": "public",
                    "site_admin": False,
                },
                "body": "What is this for? Can we not bump `fastlane-plugin-sentry` like usual?",
                "created_at": "2025-09-02T15:56:59Z",
                "updated_at": "2025-09-02T16:01:20Z",
                "html_url": "https://github.com/test-org/test-repo/pull/554#discussion_r4444444444",
                "pull_request_url": "https://api.github.com/repos/test-org/test-repo/pulls/554",
                "author_association": "MEMBER",
                "_links": {
                    "self": {
                        "href": "https://api.github.com/repos/test-org/test-repo/pulls/comments/4444444444"
                    },
                    "html": {
                        "href": "https://github.com/test-org/test-repo/pull/554#discussion_r4444444444"
                    },
                    "pull_request": {
                        "href": "https://api.github.com/repos/test-org/test-repo/pulls/554"
                    },
                },
                "reactions": {
                    "url": "https://api.github.com/repos/test-org/test-repo/pulls/comments/4444444444/reactions",
                    "total_count": 0,
                    "+1": 0,
                    "-1": 0,
                    "laugh": 0,
                    "hooray": 0,
                    "confused": 0,
                    "heart": 0,
                    "rocket": 0,
                    "eyes": 0,
                },
                "start_line": None,
                "original_start_line": None,
                "start_side": None,
                "line": 1,
                "original_line": 1,
                "side": "RIGHT",
                "original_position": 1,
                "position": 1,
                "subject_type": "line",
            },
            {
                "url": "https://api.github.com/repos/test-org/test-repo/pulls/comments/6666666666",
                "pull_request_review_id": 7777777777,
                "id": 6666666666,
                "node_id": "PRRC_kwDOKLDwMM6KFYov",
                "diff_hunk": "@@ -1,3 +1,11 @@\n+GIT",
                "path": "ios/Gemfile.lock",
                "commit_id": "abc123def456789",
                "original_commit_id": "abc123def456789",
                "user": {
                    "login": "reviewer2",
                    "id": 55555555,
                    "node_id": "MDQ6VXNlcjMzMjU5Nw==",
                    "avatar_url": "https://avatars.githubusercontent.com/u/55555555?v=4",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/reviewer2",
                    "html_url": "https://github.com/reviewer2",
                    "followers_url": "https://api.github.com/users/reviewer2/followers",
                    "following_url": "https://api.github.com/users/reviewer2/following{/other_user}",
                    "gists_url": "https://api.github.com/users/reviewer2/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/reviewer2/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/reviewer2/subscriptions",
                    "organizations_url": "https://api.github.com/users/reviewer2/orgs",
                    "repos_url": "https://api.github.com/users/reviewer2/repos",
                    "events_url": "https://api.github.com/users/reviewer2/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/reviewer2/received_events",
                    "type": "User",
                    "user_view_type": "public",
                    "site_admin": False,
                },
                "body": "It hasn't been released yet so this just points it to the tip of master",
                "created_at": "2025-09-02T16:57:27Z",
                "updated_at": "2025-09-02T16:57:27Z",
                "html_url": "https://github.com/test-org/test-repo/pull/554#discussion_r6666666666",
                "pull_request_url": "https://api.github.com/repos/test-org/test-repo/pulls/554",
                "author_association": "MEMBER",
                "_links": {
                    "self": {
                        "href": "https://api.github.com/repos/test-org/test-repo/pulls/comments/6666666666"
                    },
                    "html": {
                        "href": "https://github.com/test-org/test-repo/pull/554#discussion_r6666666666"
                    },
                    "pull_request": {
                        "href": "https://api.github.com/repos/test-org/test-repo/pulls/554"
                    },
                },
                "reactions": {
                    "url": "https://api.github.com/repos/test-org/test-repo/pulls/comments/6666666666/reactions",
                    "total_count": 0,
                    "+1": 0,
                    "-1": 0,
                    "laugh": 0,
                    "hooray": 0,
                    "confused": 0,
                    "heart": 0,
                    "rocket": 0,
                    "eyes": 0,
                },
                "start_line": None,
                "original_start_line": None,
                "start_side": None,
                "line": 1,
                "original_line": 1,
                "side": "RIGHT",
                "in_reply_to_id": 4444444444,
                "original_position": 1,
                "position": 1,
                "subject_type": "line",
            },
            {
                "url": "https://api.github.com/repos/test-org/test-repo/pulls/comments/8888888888",
                "pull_request_review_id": 9999999999,
                "id": 8888888888,
                "node_id": "PRRC_kwDOKLDwMM6KPRDd",
                "diff_hunk": "@@ -168,6 +168,11 @@ platform :ios do\n       project_slug: 'hackernews-ios',\n       include_sources: true\n     )\n+    sentry_upload_mobile_app(",
                "path": "ios/fastlane/Fastfile",
                "commit_id": "abc123def456789",
                "original_commit_id": "abc123def456789",
                "user": {
                    "login": "reviewer1",
                    "id": 44444444,
                    "node_id": "MDQ6VXNlcjE0NDc3OTg=",
                    "avatar_url": "https://avatars.githubusercontent.com/u/44444444?v=4",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/reviewer1",
                    "html_url": "https://github.com/reviewer1",
                    "followers_url": "https://api.github.com/users/reviewer1/followers",
                    "following_url": "https://api.github.com/users/reviewer1/following{/other_user}",
                    "gists_url": "https://api.github.com/users/reviewer1/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/reviewer1/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/reviewer1/subscriptions",
                    "organizations_url": "https://api.github.com/users/reviewer1/orgs",
                    "repos_url": "https://api.github.com/users/reviewer1/repos",
                    "events_url": "https://api.github.com/users/reviewer1/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/reviewer1/received_events",
                    "type": "User",
                    "user_view_type": "public",
                    "site_admin": False,
                },
                "body": "on second thought lets roll with this so we don't have to build the app so many times",
                "created_at": "2025-09-03T14:57:08Z",
                "updated_at": "2025-09-03T14:57:09Z",
                "html_url": "https://github.com/test-org/test-repo/pull/554#discussion_r8888888888",
                "pull_request_url": "https://api.github.com/repos/test-org/test-repo/pulls/554",
                "author_association": "MEMBER",
                "_links": {
                    "self": {
                        "href": "https://api.github.com/repos/test-org/test-repo/pulls/comments/8888888888"
                    },
                    "html": {
                        "href": "https://github.com/test-org/test-repo/pull/554#discussion_r8888888888"
                    },
                    "pull_request": {
                        "href": "https://api.github.com/repos/test-org/test-repo/pulls/554"
                    },
                },
                "reactions": {
                    "url": "https://api.github.com/repos/test-org/test-repo/pulls/comments/8888888888/reactions",
                    "total_count": 1,
                    "+1": 1,
                    "-1": 0,
                    "laugh": 0,
                    "hooray": 0,
                    "confused": 0,
                    "heart": 0,
                    "rocket": 0,
                    "eyes": 0,
                },
                "start_line": None,
                "original_start_line": None,
                "start_side": None,
                "line": 171,
                "original_line": 171,
                "side": "RIGHT",
                "in_reply_to_id": 1010101010,
                "original_position": 4,
                "position": 4,
                "subject_type": "line",
            },
        ]

        comment1 = ReviewComment.parse_obj(raw_comments[0])
        assert isinstance(comment1, ReviewComment)
        assert comment1.id == 4444444444
        assert comment1.path == "ios/Gemfile.lock"
        assert comment1.user.login == "reviewer1"
        assert comment1.line == 1
        assert comment1.side == ReviewCommentSide.RIGHT
        assert (
            comment1.body
            == "What is this for? Can we not bump `fastlane-plugin-sentry` like usual?"
        )
        assert comment1.diff_hunk == "@@ -1,3 +1,11 @@\n+GIT"
        assert comment1.in_reply_to_id is None

        comment2 = ReviewComment.parse_obj(raw_comments[1])
        assert isinstance(comment2, ReviewComment)
        assert comment2.id == 6666666666
        assert comment2.path == "ios/Gemfile.lock"
        assert comment2.user.login == "reviewer2"
        assert (
            comment2.body
            == "It hasn't been released yet so this just points it to the tip of master"
        )
        assert comment2.in_reply_to_id == 4444444444  # Reply to first comment

        comment3 = ReviewComment.parse_obj(raw_comments[2])
        assert isinstance(comment3, ReviewComment)
        assert comment3.id == 8888888888
        assert comment3.path == "ios/fastlane/Fastfile"
        assert comment3.line == 171
        assert comment3.reactions is not None
        assert comment3.reactions.total_count == 1
        assert comment3.reactions.plus_one == 1
        assert comment3.in_reply_to_id == 1010101010
