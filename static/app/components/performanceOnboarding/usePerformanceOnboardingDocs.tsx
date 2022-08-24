import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {loadDocs} from 'sentry/actionCreators/projects';
import {
  PlatformKey,
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function generateOnboardingDocKeys(platform: PlatformKey): string[] {
  return ['1-install', '2-configure', '3-verify'].map(
    key => `${platform}-performance-onboarding-${key}`
  );
}

const INITIAL_LOADING_DOCS = {};
const INITIAL_DOC_CONTENTS = {};

function usePerformanceOnboardingDocs(project: Project) {
  const organization = useOrganization();
  const api = useApi();

  const [loadingDocs, setLoadingDocs] =
    useState<Record<string, boolean>>(INITIAL_LOADING_DOCS);
  const [docContents, setDocContents] =
    useState<Record<string, string>>(INITIAL_DOC_CONTENTS);

  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const hasPerformanceOnboarding = currentPlatform
    ? withPerformanceOnboarding.has(currentPlatform.id)
    : false;

  const doesNotSupportPerformance = currentPlatform
    ? withoutPerformanceSupport.has(currentPlatform.id)
    : false;

  useEffect(() => {
    if (!currentPlatform || !hasPerformanceOnboarding || doesNotSupportPerformance) {
      if (loadingDocs !== INITIAL_LOADING_DOCS) {
        setLoadingDocs(INITIAL_LOADING_DOCS);
      }
      if (docContents !== INITIAL_DOC_CONTENTS) {
        setDocContents(INITIAL_DOC_CONTENTS);
      }
      return;
    }

    const docKeys = generateOnboardingDocKeys(currentPlatform.id);

    docKeys.forEach(docKey => {
      if (docKey in loadingDocs) {
        // If a documentation content is loading, we should not attempt to fetch it again.
        // otherwise, if it's not loading, we should only fetch at most once.
        // Any errors that occurred will be captured via Sentry.
        return;
      }

      const setLoadingDoc = (loadingState: boolean) =>
        setLoadingDocs(prevState => {
          return {
            ...prevState,
            [docKey]: loadingState,
          };
        });

      const setDocContent = (docContent: string | undefined) =>
        setDocContents(prevState => {
          if (docContent === undefined) {
            const newState = {
              ...prevState,
            };
            delete newState[docKey];
            return newState;
          }
          return {
            ...prevState,
            [docKey]: docContent,
          };
        });

      setLoadingDoc(true);

      loadDocs(api, organization.slug, project.slug, docKey as any)
        .then(({html}) => {
          setDocContent(html as string);
          setLoadingDoc(false);
        })
        .catch(error => {
          Sentry.captureException(error);
          setDocContent(undefined);
          setLoadingDoc(false);
        });
    });
  }, [
    currentPlatform,
    hasPerformanceOnboarding,
    doesNotSupportPerformance,
    api,
    loadingDocs,
    organization.slug,
    project.slug,
    docContents,
  ]);

  if (!currentPlatform || !hasPerformanceOnboarding || doesNotSupportPerformance) {
    return {
      isLoading: false,
      hasOnboardingContents: false,
      docContents: {},
    };
  }

  const docKeys = generateOnboardingDocKeys(currentPlatform.id);

  const isLoading = docKeys.some(key => {
    if (key in loadingDocs) {
      return !!loadingDocs[key];
    }
    return true;
  });

  const hasOnboardingContents = docKeys.every(
    key => typeof docContents[key] === 'string'
  );

  return {
    isLoading,
    hasOnboardingContents,
    docContents,
  };
}

export default usePerformanceOnboardingDocs;
