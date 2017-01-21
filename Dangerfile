# TODO(drcamer): Danger supports a shared Dangerfile that we can reference
# from our other repos (e.g. getsentry/danger)
# see also: https://github.com/samdmarshall/danger/blob/master/Dangerfile
#      and: https://github.com/samdmarshall/pyconfig/blob/develop/Dangerfile

# set the number of lines that must be changed before this classifies as a "Big PR"
@S_BIG_PR_LINES ||= 500

# require changelog entry if number of lines changed is beyond this
@S_CHANGE_LINES ||= 50

# pattern list for included file paths
@S_CHANGES_REQUIRED_PATTERNS ||= /^src\//

# set the files to watch and warn about if there are changes made
@S_BUILD_FILES ||= [
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
@S_LICENSE_FILES ||= ["LICENSE"]

# set the patterns to watch and warn about if they need security review
@S_SECURITY_FILE_PATTERN ||= /Dangerfile|(auth|login|permission|email|twofactor|sudo).*\.py/
# content changes within the diff
@S_SECURITY_CONTENT_PATTERN ||= /auth|password|permission|token|secret|security|scope|api_key|apikey|sudo/
# dont ever match against changes in these files
@S_SECURITY_EXCLUDE_FILES ||= /test_.*\.py|migrations|south_migrations|CHANGES|tests/

@S_BACKPORTED_FILES ||= [
    "src/sentry/auth/password_validation.py",
]

# determine if any of the files were modified
def checkFiles(files_array)
    files_array.select { |f| git.modified_files.include?(f) }
end

def checkFilesPattern(pattern, exclude = nil)
    git.modified_files.select do |f|
        next(false) if exclude && exclude =~ f
        next(pattern =~ f)
    end
end

def checkContents(pattern, exclude = nil)
    git.modified_files.select do |f|
        next(false) if exclude && exclude =~ f
        next(git.diff_for_file(f).patch =~ pattern)
    end
end

# Warn about changes to dependencies or the build process
warn("Changes to build requirements") if checkFiles(@S_BUILD_FILES).any?

# Warn about changes to dependencies or the build process
securityMatches = checkFilesPattern(@S_SECURITY_FILE_PATTERN, @S_SECURITY_EXCLUDE_FILES) + checkContents(@S_SECURITY_CONTENT_PATTERN, @S_SECURITY_EXCLUDE_FILES)
if securityMatches.any?
    unless github.pr_labels.include?("Security")
        github.api.update_issue(github.pr_json["head"]["repo"]["full_name"], github.pr_json["number"], {
            :labels => github.pr_labels + ["Security"],
        })
    end

    # TODO(dcramer): when GitHub API actually exposes reviewers, we should
    # make this failing
    # securityTeam = github.api.organization_teams('getsentry')[0]
    # Make a note about contributors not in the organization
    # unless github.api.team_member?(securityTeam.id, github.pr_author
    warn("Changes require @getsentry/security sign-off")
    message = "### Security concerns found\n\n"
    securityMatches.to_set.each do |m|
        message << "- #{m}\n"
    end
    markdown(message)
end

# Make it more obvious that a PR is a work in progress and shouldn"t be merged yet
warn("PR is classed as Work in Progress") if github.pr_title.include? "[WIP]"

# Warn when there is a big PR
warn("Big PR -- consider splitting it up into multiple changesets") if git.lines_of_code > @S_BIG_PR_LINES

# License is immutable
fail("Do not modify the License") if @S_LICENSE_FILES && checkFiles(@S_LICENSE_FILES).any?

# Notify about modifications to files that we've backported explicitly
warn("This change includes modification to a file that was backported from newer Django.") if @S_BACKPORTED_FILES && checkFiles(@S_BACKPORTED_FILES).any?

# Reasonable commits must update CHANGES
if @S_CHANGE_LINES && git.lines_of_code > @S_CHANGE_LINES && !git.modified_files.include?("CHANGES") && checkFilesPattern(@S_CHANGES_REQUIRED_PATTERNS).any?
    fail("You need to update CHANGES due to the size of this PR")
end
