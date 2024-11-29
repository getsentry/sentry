import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import TextArea from 'sentry/components/forms/controls/textarea';
import Input from 'sentry/components/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function WidgetBuilderNameAndDescription() {
  const [isDescSelected, setIsDescSelected] = useState(false);

  return (
    <Fragment>
      <Header>{t('Widget Name & Description')}</Header>
      <StyledInput
        size="md"
        placeholder={t('Name')}
        title={t('Widget Name')}
        type="text"
        aria-label={t('Widget Name')}
      />
      {!isDescSelected && (
        <AddDescriptionButton
          priority="link"
          aria-label={t('Add Widget Description')}
          onClick={() => {
            setIsDescSelected(true);
          }}
        >
          {t('+ Add Widget Description')}
        </AddDescriptionButton>
      )}
      {isDescSelected && (
        <DescriptionTextArea
          placeholder={t('Description')}
          aria-label={t('Widget Description')}
          autosize
          rows={4}
        />
      )}
    </Fragment>
  );
}

export default WidgetBuilderNameAndDescription;

const Header = styled('h6')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
`;

const StyledInput = styled(Input)`
  margin-bottom: ${space(1)};
`;

const AddDescriptionButton = styled(Button)`
  margin-bottom: ${space(1)};
`;

const DescriptionTextArea = styled(TextArea)`
  margin: ${space(2)} 0;
`;
