import {createContext, useContext, useEffect, useMemo} from 'react';

type Props = {
  children?: React.ReactNode;
  /**
   * Should the ` - Sentry` suffix be excluded?
   */
  noSuffix?: boolean;
  /**
   * The organization slug to show in the title
   */
  orgSlug?: string;
  /**
   * The project slug to show in the title.
   */
  projectSlug?: string;

  /**
   * This string will be shown at the very front of the title
   */
  title?: string;
};

const DEFAULT_PAGE_TITLE = 'Sentry';

const DocumentTitleContext = createContext(DEFAULT_PAGE_TITLE);

/**
 * Assigns the document title. The deepest nested version of this title will be
 * the one which is assigned.
 */
function SentryDocumentTitle({
  title = '',
  orgSlug,
  projectSlug,
  noSuffix,
  children,
}: Props) {
  const parentTitle = useContext(DocumentTitleContext);

  const pageTitle = useMemo(() => {
    if (orgSlug && projectSlug) {
      return `${title} — ${orgSlug} — ${projectSlug}`;
    }

    if (orgSlug) {
      return `${title} — ${orgSlug}`;
    }

    if (projectSlug) {
      return `${title} — ${projectSlug}`;
    }

    return title;
  }, [orgSlug, projectSlug, title]);

  const documentTitle = useMemo(() => {
    if (noSuffix) {
      return pageTitle;
    }

    if (pageTitle !== '') {
      return `${pageTitle} — Sentry`;
    }

    return DEFAULT_PAGE_TITLE;
  }, [noSuffix, pageTitle]);

  // NOTE: We do this OUTSIDE of a use effect so that the update order is
  // correct, otherwsie the inner most SentryDocumentTitle will have it's
  // useEffect called first followed by the parents, which will cause the wrong
  // title be set.
  if (document.title !== documentTitle) {
    document.title = documentTitle;
  }

  useEffect(() => {
    return () => {
      document.title = parentTitle;
    };
  }, [parentTitle]);

  return (
    <DocumentTitleContext.Provider value={documentTitle}>
      {children}
    </DocumentTitleContext.Provider>
  );
}

export default SentryDocumentTitle;
