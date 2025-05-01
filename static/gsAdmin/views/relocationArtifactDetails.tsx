import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconFile} from 'sentry/icons/iconFile';
import ConfigStore from 'sentry/stores/configStore';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import DetailsPage from 'admin/components/detailsPage';

type RelocationData = {
  contents: string;
};

export default function RelocationArtifactDetails() {
  const {artifactKind, fileName, regionName, relocationUuid} = useParams<{
    artifactKind: string;
    fileName: string;
    regionName: string;
    relocationUuid: string;
  }>();
  const region = ConfigStore.get('regions').find((r: any) => r.name === regionName);

  const {data, isPending, isError} = useApiQuery<RelocationData>(
    [
      `/relocations/${relocationUuid}/artifacts/${artifactKind}/${fileName}`,
      {
        host: region?.url,
      },
    ],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  return (
    <DetailsPage
      rootName="Relocation"
      name={`${artifactKind}/${fileName}`}
      crumbs={[relocationUuid]}
      sections={[
        {
          content: (
            <CodeSnippet dark filename={fileName} hideCopyButton icon={<IconFile />}>
              {data?.contents ?? ''}
            </CodeSnippet>
          ),
        },
      ]}
    />
  );
}
