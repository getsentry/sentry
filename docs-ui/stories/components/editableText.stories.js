import styled from '@emotion/styled';
import {action} from '@storybook/addon-actions';

import EditableText from 'sentry/components/editableText';
import space from 'sentry/styles/space';

export default {
  title: 'Components/Forms/Misc/Editable Text',
  component: EditableText,
};

export const _EditableText = () => {
  return (
    <Container>
      <EditableText value="Editable Text" onChange={action('onChange')} />
    </Container>
  );
};

_EditableText.storyName = 'Editable Text';
_EditableText.parameters = {
  docs: {
    description: {
      story:
        'Inline text edit. Keyboard and mouse can be used for providing or changing data.',
    },
  },
};

const Container = styled('div')`
  padding: ${space(3)};
`;
