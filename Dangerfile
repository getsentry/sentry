# TODO(drcamer): Danger supports a shared Dangerfile that we can reference
# from our other repos (e.g. getsentry/danger)
# see also: https://github.com/samdmarshall/danger/blob/master/Dangerfile
#      and: https://github.com/samdmarshall/pyconfig/blob/develop/Dangerfile

# set the number of lines that must be changed before this classifies as a "Big PR"
@S_DANGER_BIG_PR_LINES = 500

# require changelog entry if number of lines changed is beyond this
@S_DANGER_CHANGE_LINES = 50

# set the files to watch and warn about if there are changes made
@S_DANGER_BUILD_FILES = [
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
@S_DANGER_LICENSE_FILES = ["LICENSE"]

# set the patterns to watch and warn about if they need security review
@S_SECURITY_FILE_PATTERN = /auth|login|permission|email|account|admin|twofactor|sudo/
@S_SECURITY_CONTENT_PATTERN = /auth|login|permission|token|secret|security|scope|key|sudo/

# determine if any of the files were modified
def didModify(files_array)
    did_modify_files = false
    files_array.each do |file_name|
        if git.modified_files.include?(file_name) || git.deleted_files.include?(file_name)
            did_modify_files = true
        end
    end
    return did_modify_files
end

def didModifyPattern(pattern)
    did_modify_files = false
    if git.modified_files.find { |e| pattern =~ e } || git.deleted_files.find { |e| pattern =~ e }
        did_modify_files = true
    end
    return did_modify_files
end

def hasMatchingContentChanges(pattern)
    git.modified_files.each do |f|
        if git.diff_for_file[f].patch.find { |e| pattern =~ e }
            return true
        end
    end
    git.deleted_files.each do |f|
        if git.diff_for_file[f].patch.find { |e| pattern =~ e }
            return true
        end
    end
end

# Warn about changes to dependencies or the build process
warn("Changes to build requirements") if didModify(@S_DANGER_BUILD_FILES)

# Warn about changes to dependencies or the build process
if didModifyPattern(@S_SECURITY_FILE_PATTERN) || hasMatchingContentChanges(@S_SECURITY_CONTENT_PATTERN)
    warn("Changes require @getsentry/security sign-off")
end

# Make it more obvious that a PR is a work in progress and shouldn"t be merged yet
warn("PR is classed as Work in Progress") if github.pr_title.include? "[WIP]"

# Warn when there is a big PR
warn("Big PR -- consider splitting it up into multiple changesets") if git.lines_of_code > @S_DANGER_BIG_PR_LINES

# License is immutable
fail("Do not modify the License") if didModify(@S_DANGER_LICENSE_FILES)

# Reasonable commits must update CHANGES
fail("Missing an update to CHANGES") if git.lines_of_code > @S_DANGER_CHANGE_LINES && !git.modified_files.include?("CHANGES")
