import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';

import {MissingExampleWarning} from './missingExampleWarning';
import {DocsWrapper, PlatformDoc} from '.';

export function SdkDoc(props: {
  hasError: boolean;
  onRetry: () => void;
  organization: Organization;
  platform: PlatformKey | null;
  platformDocs: PlatformDoc | null;
  project: Project;
}) {
  const currentPlatform = props.platform ?? props.project?.platform ?? 'other';

  return (
    <Fragment>
      <SetupIntroduction
        stepHeaderText={t(
          'Configure %s SDK',
          platforms.find(p => p.id === currentPlatform)?.name ?? ''
        )}
        platform={currentPlatform}
      />
      {getDynamicText({
        value: !props.hasError ? (
          props.platformDocs !== null && (
            <DocsWrapper key={props.platformDocs.html}>
              <DocumentationWrapper
                dangerouslySetInnerHTML={{__html: props.platformDocs.html}}
              />
              <MissingExampleWarning
                platform={props.platform}
                platformDocs={props.platformDocs}
              />
            </DocsWrapper>
          )
        ) : (
          <LoadingError
            message={t(
              'Failed to load documentation for the %s platform.',
              props.project?.platform
            )}
            onRetry={props.onRetry}
          />
        ),
        fixed: (
          <Alert type="warning">
            Platform documentation is not rendered in for tests in CI
          </Alert>
        ),
      })}
    </Fragment>
  );
}
