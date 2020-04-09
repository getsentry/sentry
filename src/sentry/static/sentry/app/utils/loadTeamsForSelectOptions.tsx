import {Client} from 'app/api';

/**
 * Used for async `react-select` component to choose and filter teams
 */
function loadTeamsForSelectOptions(orgSlug: string) {
  const api = new Client();

  return async (inputValue: string) => {
    const resp = await api.requestPromise(`/organizations/${orgSlug}/teams/`, {
      query: {query: inputValue, per_page: 25},
    });

    return {options: resp?.map(({slug}) => ({value: slug, label: `#${slug}`}))};
  };
}

export default loadTeamsForSelectOptions;
