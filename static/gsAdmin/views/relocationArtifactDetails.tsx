import {IconFile} from '@sentry/icons/file';
import {useQuery} from '@tanstack/react-query';

import {CodeBlock} from '@sentry/scraps/codeBlock';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getLocalities} from 'sentry/utils/cells';
import {useParams} from 'sentry/utils/useParams';

import {DetailsPage} from 'admin/components/detailsPage';

type RelocationData = {
  contents: string;
};

export function RelocationArtifactDetails() {
  const {artifactKind, fileName, regionName, relocationUuid} = useParams<{
    artifactKind: string;
    fileName: string;
    regionName: string;
    relocationUuid: string;
  }>();
  const locality = getLocalities().find(l => l.name === regionName);

  const {data, isPending, isError} = useQuery(
    apiOptions.as<RelocationData>()(
      '/relocations/$relocationUuid/artifacts/$artifactKind/$fileName',
      {path: {relocationUuid, artifactKind, fileName}, host: locality?.url, staleTime: 0}
    )
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
            <CodeBlock dark filename={fileName} hideCopyButton icon={<IconFile />}>
              {data?.contents ?? ''}
            </CodeBlock>
          ),
        },
      ]}
    />
  );
}
