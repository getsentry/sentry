import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import TextArea from 'sentry/components/forms/controls/textarea';
import TextField from 'sentry/components/forms/fields/textField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

interface WidgetBuilderNameAndDescriptionProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

function WidgetBuilderNameAndDescription({
  error,
  setError,
}: WidgetBuilderNameAndDescriptionProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const [isDescSelected, setIsDescSelected] = useState(state.description ? true : false);

  return (
    <Fragment>
      <SectionHeader title={t('Widget Name & Description')} />
      <StyledInput
        name={t('Widget Name')}
        size="md"
        placeholder={t('Name')}
        title={t('Widget Name')}
        aria-label={t('Widget Name')}
        value={state.title}
        onChange={newTitle => {
          // clear error once user starts typing
          setError?.({...error, title: undefined});
          dispatch({type: BuilderStateAction.SET_TITLE, payload: newTitle});
        }}
        required
        error={error?.title}
        inline={false}
      />
      {!isDescSelected && (
        <AddDescriptionButton
          priority="link"
          aria-label={t('Add Widget Description')}
          onClick={() => {
            setIsDescSelected(true);
          }}
          data-test-id={'add-description'}
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
          value={state.description}
          onChange={e => {
            dispatch({type: BuilderStateAction.SET_DESCRIPTION, payload: e.target.value});
          }}
        />
      )}
    </Fragment>
  );
}

export default WidgetBuilderNameAndDescription;

const StyledInput = styled(TextField)`
  margin-bottom: ${space(1)};
  padding: 0;
  border: none;
`;

const AddDescriptionButton = styled(Button)`
  margin-bottom: ${space(1)};
`;

const DescriptionTextArea = styled(TextArea)`
  margin: ${space(2)} 0;
`;
