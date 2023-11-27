import {useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {loadDocs} from 'sentry/actionCreators/projects';
import platforms from 'sentry/data/platforms';
import {Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const INITIAL_LOADING_DOCS = {};
const INITIAL_DOC_CONTENTS = {};

type Options = {
  docKeys: string[];
  isPlatformSupported: boolean;
  project: Project;
};

function useOnboardingDocs({docKeys, isPlatformSupported, project}: Options) {
  const api = useApi();
  const organization = useOrganization();

  const loadingDocsRef = useRef<Record<string, boolean>>(INITIAL_LOADING_DOCS);
  const docContentsRef = useRef<Record<string, string>>(INITIAL_DOC_CONTENTS);

  const [docContents, setDocContents] =
    useState<Record<string, string>>(INITIAL_DOC_CONTENTS);

  docContentsRef.current = docContents;

  useEffect(() => {
    if (!isPlatformSupported) {
      if (loadingDocsRef.current !== INITIAL_LOADING_DOCS) {
        loadingDocsRef.current = INITIAL_LOADING_DOCS;
      }
      if (docContentsRef.current !== INITIAL_DOC_CONTENTS) {
        setDocContents(INITIAL_DOC_CONTENTS);
      }
      return undefined;
    }

    let cancelRequest = false;

    docKeys.forEach(docKey => {
      if (docKey in loadingDocsRef.current) {
        // If a documentation content is loading, we should not attempt to fetch it again.
        // otherwise, if it's not loading, we should only fetch at most once.
        // Any errors that occurred will be captured via Sentry.
        return;
      }

      const setLoadingDoc = (loadingState: boolean) => {
        loadingDocsRef.current = {
          ...loadingDocsRef.current,
          [docKey]: loadingState,
        };
      };

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

      loadDocs({
        api,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        platform: docKey as any,
      })
        .then(({html}) => {
          if (cancelRequest) {
            return;
          }
          setLoadingDoc(false);
          setDocContent(html as string);
        })
        .catch(error => {
          if (cancelRequest) {
            return;
          }
          Sentry.captureException(error);
          setLoadingDoc(false);
          setDocContent(undefined);
        });
    });

    return () => {
      cancelRequest = true;
      for (const key of docKeys) {
        delete loadingDocsRef.current[key];
      }
    };
  }, [docKeys, isPlatformSupported, api, organization.slug, project]);

  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  if (!currentPlatform || !isPlatformSupported) {
    return {
      isLoading: false,
      hasOnboardingContents: false,
      docContents: {},
    };
  }

  const isLoading =
    docKeys &&
    docKeys.some(key => {
      if (key in loadingDocsRef.current) {
        return !!loadingDocsRef.current[key];
      }
      return true;
    });

  return {
    docKeys,
    isLoading,
    hasOnboardingContents:
      docKeys && docKeys.every(key => typeof docContents[key] === 'string'),
    docContents,
  };
}

export default useOnboardingDocs;
