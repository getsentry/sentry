import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import GlobalModal from 'sentry/components/globalModal';
import ColumnEditModal, {modalCss} from 'sentry/views/eventsV2/table/columnEditModal';

const columns = [
  {
    kind: 'field',
    field: 'event.type',
  },
  {
    kind: 'field',
    field: 'browser.name',
  },
  {
    kind: 'function',
    function: ['count', 'id'],
  },
  {
    kind: 'function',
    function: ['count_unique', 'title'],
  },
  {
    kind: 'function',
    function: ['p95'],
  },
  {
    kind: 'field',
    field: 'issue.id',
  },
  {
    kind: 'function',
    function: ['count_unique', 'issue.id'],
  },
  {
    kind: 'function',
    function: ['percentile', 'transaction.duration', '0.81'],
  },
  {
    kind: 'field',
    field: 'tags[project]',
  },
];

export default {
  title: 'Components/Tables/ColumnEditor',
  component: ColumnEditModal,
  args: {
    tags: ['browser.name', 'custom-field', 'project'],
    columns,
  },
  argTypes: {
    organization: {
      table: {
        disable: true,
      },
    },
    header: {
      table: {
        disable: true,
      },
    },
    body: {
      table: {
        disable: true,
      },
    },
    footer: {
      table: {
        disable: true,
      },
    },
    onApply: {action: 'onApply'},
  },
};

export const Default = ({...args}) => {
  const organization = {
    slug: 'test-org',
    features: ['discover-query', 'performance-view'],
  };

  const showModal = () => {
    openModal(
      modalProps => (
        <ColumnEditModal {...modalProps} organization={organization} {...args} />
      ),
      {modalCss}
    );
  };

  return (
    <div>
      <Button onClick={showModal}>Edit columns</Button>
      <GlobalModal />
    </div>
  );
};

Default.storyName = 'ColumnEditor';
Default.parameters = {
  docs: {
    description: {
      story: 'Playground for building out column editor v2 for discover',
    },
  },
};
