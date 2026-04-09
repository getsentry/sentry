import type {ReactNode} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {
  SourceMapDebugBlueThunderResponse,
  SourceMapDebugQueryResult,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

function getDiagnosisMessage(
  data: SourceMapDebugBlueThunderResponse | undefined
): ReactNode | null {
  if (!data) {
    return (
      <Text>{t('Unable to load source map diagnostic information for this event.')}</Text>
    );
  }

  const release = data.release ? (
    <InlineCode variant="neutral">{data.release}</InlineCode>
  ) : null;

  for (const exception of data.exceptions) {
    for (const frame of exception.frames) {
      const rel = frame.release_process;
      const scraping = frame.scraping_process;

      if (rel) {
        const filePath = <InlineCode>{rel.abs_path}</InlineCode>;

        if (rel.source_file_lookup_result === 'wrong-dist') {
          return (
            <Text>
              {release
                ? tct(
                    'The source file [filePath] was found but the dist value does not match the uploaded artifact in release [release].',
                    {filePath, release}
                  )
                : tct(
                    'The source file [filePath] was found but the dist value does not match the uploaded artifact.',
                    {filePath}
                  )}
            </Text>
          );
        }
        if (rel.source_map_lookup_result === 'wrong-dist' && rel.source_map_reference) {
          const mapRef = <InlineCode>{rel.source_map_reference}</InlineCode>;
          return (
            <Text>
              {release
                ? tct(
                    'The source map [mapRef] was found but the dist value does not match the uploaded artifact in release [release].',
                    {mapRef, release}
                  )
                : tct(
                    'The source map [mapRef] was found but the dist value does not match the uploaded artifact.',
                    {mapRef}
                  )}
            </Text>
          );
        }
        if (
          rel.source_file_lookup_result === 'unsuccessful' &&
          rel.source_map_reference === null
        ) {
          return (
            <Text>
              {release
                ? tct(
                    'The source file [filePath] could not be found in any uploaded artifact bundle in release [release]. No source map reference was detected.',
                    {filePath, release}
                  )
                : tct(
                    'The source file [filePath] could not be found in any uploaded artifact bundle. No source map reference was detected.',
                    {filePath}
                  )}
            </Text>
          );
        }
        if (rel.source_map_lookup_result === 'unsuccessful' && rel.source_map_reference) {
          const mapRef = <InlineCode>{rel.source_map_reference}</InlineCode>;
          return (
            <Text>
              {release
                ? tct(
                    'The source map referenced by [filePath] points to [mapRef], but no matching artifact was found in release [release].',
                    {filePath, mapRef, release}
                  )
                : tct(
                    'The source map referenced by [filePath] points to [mapRef], but no matching artifact was found.',
                    {filePath, mapRef}
                  )}
            </Text>
          );
        }
      }

      if (scraping) {
        if (scraping.source_file?.status === 'failure') {
          return (
            <Text>
              {tct('Sentry could not fetch the source file at [url]: [reason].', {
                url: <InlineCode>{scraping.source_file.url}</InlineCode>,
                reason: scraping.source_file.reason,
              })}
            </Text>
          );
        }
        if (scraping.source_map?.status === 'failure') {
          return (
            <Text>
              {tct('Sentry could not fetch the source map at [url]: [reason].', {
                url: <InlineCode>{scraping.source_map.url}</InlineCode>,
                reason: scraping.source_map.reason,
              })}
            </Text>
          );
        }
      }
    }
  }

  if (!data.project_has_some_artifact_bundle && !data.release_has_some_artifact) {
    return (
      <Stack gap="lg">
        <Text>
          {release
            ? tct(
                'No source map artifacts have been uploaded for this project in release [release].',
                {release}
              )
            : t('No source map artifacts have been uploaded for this project.')}
        </Text>
        <div>
          <LinkButton
            size="sm"
            icon={<IconOpen />}
            external
            href="https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/"
          >
            {t('Upload Instructions')}
          </LinkButton>
        </div>
      </Stack>
    );
  }

  return (
    <Text>
      {t(
        'Source maps appear to be configured but Sentry could not pinpoint the exact issue.'
      )}
    </Text>
  );
}

interface DiagnosisSectionProps {
  sourceMapQuery: SourceMapDebugQueryResult;
}

export function DiagnosisSection({sourceMapQuery}: DiagnosisSectionProps) {
  const {data, isLoading, isError} = sourceMapQuery;

  function renderContent(): ReactNode {
    if (isLoading) {
      return <LoadingIndicator mini />;
    }
    if (isError) {
      return (
        <LoadingError
          message={t('Unable to load source map diagnostic information for this event.')}
        />
      );
    }

    return getDiagnosisMessage(data);
  }

  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Diagnosis')}</Heading>
      {renderContent()}
    </Stack>
  );
}
