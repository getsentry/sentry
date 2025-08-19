import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useProjects from 'sentry/utils/useProjects';

export default function useAssertionBaseFormQueryParams() {
  const {projects} = useProjects();

  const {
    project: projectSlug,
    environment,
    name,
  } = useLocationQuery({
    fields: {
      project: decodeScalar,
      environment: decodeScalar,
      name: decodeScalar,
    },
  });

  const {setParamValue: setProjectSlug} = useUrlParams('project');
  const {setParamValue: setEnvironment} = useUrlParams('environment');
  const {setParamValue: setName} = useUrlParams('name');

  const project = projects.find(p => p.slug === projectSlug || p.id === projectSlug);

  return {
    project,
    environment,
    name,
    setProjectSlug,
    setEnvironment,
    setName,
  };
}
