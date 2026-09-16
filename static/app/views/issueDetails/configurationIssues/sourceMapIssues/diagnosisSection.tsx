import {LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {SourceMapDebugQueryResult} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import {getSourceMapDiagnosis, type SourceMapDiagnosis} from './sourceMapDiagnosis';

function getDiagnosisMessage(diagnosis: SourceMapDiagnosis) {
  const release =
    'release' in diagnosis && diagnosis.release ? (
      <InlineCode variant="neutral">{diagnosis.release}</InlineCode>
    ) : null;
  const filePath = 'path' in diagnosis ? <InlineCode>{diagnosis.path}</InlineCode> : null;

  switch (diagnosis.type) {
    case 'dist-mismatch':
      if (diagnosis.artifact === 'source-file') {
        return release
          ? tct(
              'The source file [filePath] was found but the dist value does not match the uploaded artifact in release [release].',
              {filePath, release}
            )
          : tct(
              'The source file [filePath] was found but the dist value does not match the uploaded artifact.',
              {filePath}
            );
      }
      return release
        ? tct(
            'The source map [mapRef] was found but the dist value does not match the uploaded artifact in release [release].',
            {mapRef: filePath, release}
          )
        : tct(
            'The source map [mapRef] was found but the dist value does not match the uploaded artifact.',
            {mapRef: filePath}
          );
    case 'missing-source':
      return release
        ? tct(
            'The source file [filePath] could not be found in any uploaded artifact bundle in release [release]. No source map reference was detected.',
            {filePath, release}
          )
        : tct(
            'The source file [filePath] could not be found in any uploaded artifact bundle. No source map reference was detected.',
            {filePath}
          );
    case 'missing-map': {
      const mapRef = <InlineCode>{diagnosis.reference}</InlineCode>;
      return release
        ? tct(
            'The source map referenced by [filePath] points to [mapRef], but no matching artifact was found in release [release].',
            {filePath, mapRef, release}
          )
        : tct(
            'The source map referenced by [filePath] points to [mapRef], but no matching artifact was found.',
            {filePath, mapRef}
          );
    }
    case 'fetch-failure': {
      const values = {
        url: <InlineCode>{diagnosis.url}</InlineCode>,
        reason: diagnosis.reason,
      };
      return diagnosis.artifact === 'source-file'
        ? tct('Sentry could not fetch the source file at [url]: [reason].', values)
        : tct('Sentry could not fetch the source map at [url]: [reason].', values);
    }
    case 'no-artifacts':
      return release
        ? tct(
            'No source map artifacts have been uploaded for this project in release [release].',
            {release}
          )
        : t('No source map artifacts have been uploaded for this project.');
    case 'unknown':
      return t(
        'Source maps appear to be configured but Sentry could not pinpoint the exact issue.'
      );
    default:
      return null;
  }
}

export function DiagnosisSection({
  sourceMapQuery,
}: {
  sourceMapQuery: SourceMapDebugQueryResult;
}) {
  const {data, isLoading, isError} = sourceMapQuery;

  function renderContent() {
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
    if (!data) {
      return (
        <Text>
          {t('Unable to load source map diagnostic information for this event.')}
        </Text>
      );
    }
    const diagnosis = getSourceMapDiagnosis(data);
    return (
      <Stack gap="lg">
        <Text variant="muted">{t('Based on a sample event for this issue.')}</Text>
        <Text>{getDiagnosisMessage(diagnosis)}</Text>
        {diagnosis.type === 'no-artifacts' && (
          <Container>
            <LinkButton
              size="sm"
              icon={<IconOpen />}
              external
              href="https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/"
            >
              {t('Upload Instructions')}
            </LinkButton>
          </Container>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Diagnosis')}</Heading>
      {renderContent()}
    </Stack>
  );
}
