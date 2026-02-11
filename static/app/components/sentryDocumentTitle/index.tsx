import {useEffect, useId, useMemo, useState} from 'react';

import {useDocumentTitleManager} from './documentTitleManager';

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

function SentryDocumentTitle({
  title = '',
  orgSlug,
  projectSlug,
  noSuffix,
  children,
}: Props) {
  const titleManager = useDocumentTitleManager();
  const id = useId();
  // compute order once on mount because effects run bottom-up
  const [order] = useState(() => performance.now());

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

  // create or update title entry
  useEffect(() => {
    titleManager.register(id, pageTitle, order, !!noSuffix);
  }, [titleManager, id, pageTitle, order, noSuffix]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      titleManager.unregister(id);
    };
  }, [titleManager, id]);

  return children;
}

export default SentryDocumentTitle;
