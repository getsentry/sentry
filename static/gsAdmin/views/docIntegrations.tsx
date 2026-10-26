import {DocIntegrationAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {DocIntegration} from 'sentry/types/integrations';

import {DocIntegrationModal} from 'admin/components/docIntegrationModal';
import {PageHeader} from 'admin/components/pageHeader';

const getRow = (doc: DocIntegration) => [
  <SimpleTable.RowCell key="name">
    <Flex align="center" gap="md">
      <DocIntegrationAvatar size={16} docIntegration={doc} />
      <strong>
        <Link to={`/_admin/doc-integrations/${doc.slug}/`}>{doc.name}</Link>
      </strong>
    </Flex>
  </SimpleTable.RowCell>,

  <SimpleTable.RowCell key="author" justify="center">
    {doc.author}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="popularity" justify="center">
    {doc.popularity}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="end">
    <Tag variant={doc.isDraft ? 'warning' : 'success'}>
      {doc.isDraft ? 'draft' : 'published'}
    </Tag>
  </SimpleTable.RowCell>,
];

export function DocIntegrations() {
  const {openModal} = useModal();

  return (
    <div>
      <PageHeader title="Document Integrations">
        <Button
          onClick={() => openModal(deps => <DocIntegrationModal {...deps} />)}
          variant="primary"
          size="sm"
        >
          Create Doc Integration
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/doc-integrations/"
        endpoint="/doc-integrations/"
        columns={[
          {key: 'name', label: 'Name', width: 150},
          {key: 'author', label: 'Author', width: 150, align: 'center'},
          {key: 'popularity', label: 'Popularity ⭐', width: 150, align: 'center'},
          {key: 'status', label: 'Status', width: 150, align: 'right'},
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}
