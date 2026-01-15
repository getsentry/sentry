import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import type {DocIntegration} from 'sentry/types/integrations';

import DocIntegrationModal from 'admin/components/docIntegrationModal';
import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';

const getRow = (doc: DocIntegration) => [
  <td key="name" style={{textAlign: 'left'}}>
    <Flex align="center" gap="md">
      <DocIntegrationAvatar size={16} docIntegration={doc} />
      <strong>
        <Link to={`/_admin/doc-integrations/${doc.slug}/`}>{doc.name}</Link>
      </strong>
    </Flex>
  </td>,

  <td key="author" style={{textAlign: 'center'}}>
    {doc.author}
  </td>,
  <td key="popularity" style={{textAlign: 'center'}}>
    {doc.popularity}
  </td>,
  <td key="status" style={{textAlign: 'right'}}>
    <Tag variant={doc.isDraft === true ? 'warning' : 'success'}>
      {doc.isDraft === false ? 'published' : 'draft'}
    </Tag>
  </td>,
];

export default function DocIntegrations() {
  return (
    <div>
      <PageHeader title="Document Integrations">
        <Button
          onClick={() => openModal(deps => <DocIntegrationModal {...deps} />)}
          priority="primary"
          size="sm"
        >
          Create Doc Integration
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/doc-integrations/"
        endpoint="/doc-integrations/"
        method="GET"
        columns={[
          <th key="name" style={{width: 150, textAlign: 'left'}}>
            Author
          </th>,
          <th key="author" style={{width: 150, textAlign: 'center'}}>
            Author
          </th>,
          <th key="popularity" style={{width: 150, textAlign: 'center'}}>
            Popularity ⭐
          </th>,
          <th key="status" style={{width: 150, textAlign: 'right'}}>
            Status
          </th>,
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}
