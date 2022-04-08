import Button from 'sentry/components/button';
import ConfirmDelete from 'sentry/components/confirmDelete';

// TODO(scttcper): modal not working
export default {
  title: 'Components/Buttons/Confirm',
  component: ConfirmDelete,
  args: {
    confirmInput: 'Type this out',
    message: 'Are you sure you want to do this?',
  },
  argTypes: {
    onConfirm: {action: 'confirmed'},
  },
};

export const _ConfirmDelete = ({...args}) => (
  <div>
    <ConfirmDelete {...args}>
      <Button priority="primary">Confirm on Button click</Button>
    </ConfirmDelete>
  </div>
);

_ConfirmDelete.storyName = 'Confirm Delete';
_ConfirmDelete.parameters = {
  docs: {
    description: {
      story: 'A Confirm Modal that requires a user to enter a confirmation string.',
    },
  },
};
