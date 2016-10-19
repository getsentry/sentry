# TODO(drcamer): Danger supports a shared Dangerfile that we can reference
# from our other repos (e.g. getsentry/danger)
# see also: https://github.com/samdmarshall/danger/blob/master/Dangerfile
#      and: https://github.com/samdmarshall/pyconfig/blob/develop/Dangerfile

# set the number of lines that must be changed before this classifies as a "Big PR"
@S_BIG_PR_LINES = 500

# require changelog entry if number of lines changed is beyond this
@S_CHANGE_LINES = 50

# pattern list for included file paths
@S_CHANGES_REQUIRED_PATTERNS = /^src\//

# set the files to watch and warn about if there are changes made
@S_BUILD_FILES = [
    "Makefile",

    # JavaScript
    ".eslintignore",
    ".eslintrc",

    # Python
    "setup.cfg",
    "setup.py",
    "tox.ini",

    # Danger
    "Dangerfile",

    # CI
    ".travis.yml",
]

# set the files to watch and fail if there are changes
@S_LICENSE_FILES = ["LICENSE"]

# set the patterns to watch and warn about if they need security review
@S_SECURITY_FILE_PATTERN = /Dangerfile|auth|login|permission|email|account|admin|twofactor|sudo/
@S_SECURITY_CONTENT_PATTERN = /auth|login|password|permission|token|secret|security|scope|key|sudo/

# determine if any of the files were modified
def didModify(files_array)
    did_modify_files = false
    files_array.each do |file_name|
        if git.modified_files.include?(file_name)
            did_modify_files = true
        end
    end
    return did_modify_files
end

def didModifyPattern(pattern)
    did_modify_files = false
    if git.modified_files.find { |e| pattern =~ e }
        did_modify_files = true
    end
    return did_modify_files
end

def hasMatchingContentChanges(pattern)
    return github.pr_diff =~ pattern
end

# Warn about changes to dependencies or the build process
warn("Changes to build requirements") if didModify(@S_BUILD_FILES)

# Warn about changes to dependencies or the build process
if didModifyPattern(@S_SECURITY_FILE_PATTERN) || hasMatchingContentChanges(@S_SECURITY_CONTENT_PATTERN)
    unless github.pr_labels.include?("Security")
        github.api.update_issue(github.pr_json["head"]["repo"]["full_name"], github.pr_json["id"], {
            :labels => github.pr_labels.join(",") + "Security",
        })
    end

    # TODO(dcramer): when GitHub API actually exposes reviewers, we should
    # make this failing
    # securityTeam = github.api.organization_teams('getsentry')[0]
    # Make a note about contributors not in the organization
    # unless github.api.team_member?(securityTeam.id, github.pr_author)
    warn("Changes require @getsentry/security sign-off")
end

# Make it more obvious that a PR is a work in progress and shouldn"t be merged yet
warn("PR is classed as Work in Progress") if github.pr_title.include? "[WIP]"

# Warn when there is a big PR
warn("Big PR -- consider splitting it up into multiple changesets") if git.lines_of_code > @S_BIG_PR_LINES

# License is immutable
fail("Do not modify the License") if didModify(@S_LICENSE_FILES)

# Reasonable commits must update CHANGES
if git.lines_of_code > @S_CHANGE_LINES && !git.modified_files.include?("CHANGES") && didModifyPattern(@S_CHANGES_REQUIRED_PATTERNS)
    fail("You need to update CHANGES due to the size of this PR")
end
