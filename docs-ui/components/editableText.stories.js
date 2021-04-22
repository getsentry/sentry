import React from 'react';
import styled from '@emotion/styled';
import {action} from '@storybook/addon-actions';

import EditableText from 'app/components/editableText';
import space from 'app/styles/space';

export default {
  title: 'Forms/EditableText',
  component: EditableText,
};

export const _EditableText = () => {
  return (
    <Container>
      <EditableText value="Editable Text" onChange={action('onChange')} />
    </Container>
  );
};

_EditableText.storyName = 'EditableText';
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
