import { FunctionComponent } from 'react';
import * as React from 'react';
import DocumentTitle from 'react-document-title';

type DocumentTitleProps = {
  // Main page title
  title: string;
  // Organization or project slug to give title some context
  objSlug: string;
  children?: React.ReactNode;
};

const SentryDocumentTitle: FunctionComponent<DocumentTitleProps> = (
  props: DocumentTitleProps
) => {
  const _title = `${props.title} - ${props.objSlug} - Sentry`;
  return <DocumentTitle title={_title}>{props.children}</DocumentTitle>;
};

export default SentryDocumentTitle;
