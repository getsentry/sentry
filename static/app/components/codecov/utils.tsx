import {CODECOV_DEFAULT_RELATIVE_PERIODS} from './datePicker/datePicker';

// Date Picker Utils Start

/**
 * Determines if a period is valid for a Codecov DatePicker component. A period is invalid if
 * it is null or if it doesn't belong to the list of Codecov default relative periods.
 */
export function isValidCodecovRelativePeriod(period: string | null): boolean {
  if (period === null) {
    return false;
  }

  if (!Object.hasOwn(CODECOV_DEFAULT_RELATIVE_PERIODS, period)) {
    return false;
  }

  return true;
}

// Date Picker Utils End

// Repo Picker Utils Start
/**
 * Creates a mapping of 'A:A' for the repository if it is not null
 */
export function mapIndividualRepository(
  repository: string | null
): Record<string, string> {
  if (repository === null) {
    return {};
  }

  return {[repository]: repository};
}

/**
 * Creates a mapping of 'A:A' for every repository in the repository list if it is not null
 */
export function mapRepositoryList(repositories: string[] | null): Record<string, string> {
  if (!repositories || (repositories && repositories.length === 0)) {
    return {};
  }

  return Object.fromEntries(repositories.map(repository => [repository, repository]));
}
// Repo Picker Utils End
