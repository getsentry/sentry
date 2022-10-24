import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {TextField} from 'sentry/components/forms';
import {PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  envVariables: {
    name: string;
    value: string;
  }[];
  setEnvVariables: (envVariables) => void;
};

function SentryFunctionEnvironmentVariables(props: Props) {
  const {envVariables, setEnvVariables} = props;

  const addEnvVar = () => {
    setEnvVariables([...envVariables, {name: '', value: ''}]);
  };

  const handleNameChange = (value: string, pos: number) => {
    const newEnvVariables = [...envVariables];
    while (newEnvVariables.length <= pos) {
      newEnvVariables.push({name: '', value: ''});
    }
    newEnvVariables[pos] = {...newEnvVariables[pos], name: value};
    setEnvVariables(newEnvVariables);
  };

  const handleValueChange = (value: string, pos: number) => {
    const newEnvVariables = [...envVariables];
    while (newEnvVariables.length <= pos) {
      newEnvVariables.push({name: '', value: ''});
    }
    newEnvVariables[pos] = {...newEnvVariables[pos], value};
    setEnvVariables(newEnvVariables);
  };

  const removeEnvVar = (pos: number) => {
    const newEnvVariables = [...envVariables];
    newEnvVariables.splice(pos, 1);
    setEnvVariables(newEnvVariables);
  };

  return (
    <div>
      <PanelHeader>
        {t('Environment Variables')}
        <StyledAddButton
          size="sm"
          type="button"
          icon={<IconAdd isCircled />}
          aria-label={t('Add Environment Variable')}
          onClick={addEnvVar}
        />
      </PanelHeader>
      <StyledPanelBody>
        <EnvironmentVariableWrapper>
          <EnvHeader>{t('Name')}</EnvHeader>
          <EnvHeaderRight>{t('Value')}</EnvHeaderRight>
        </EnvironmentVariableWrapper>
        {envVariables.map((envVariable, i) => {
          return (
            <EnvironmentVariableWrapper key={i}>
              <TextField
                name={`env-variable-name-${i}`}
                required={false}
                inline={false}
                defaultValue={envVariable.name}
                value={envVariable.name}
                stacked
                onChange={e => handleNameChange(e, i)}
              />
              <TextField
                name={`env-variable-value-${i}`}
                required={false}
                inline={false}
                defaultValue={envVariable.value}
                value={envVariable.value}
                stacked
                onChange={e => handleValueChange(e, i)}
              />
              <ButtonHolder>
                <StyledAddButton
                  size="sm"
                  icon={<IconDelete />}
                  type="button"
                  aria-label={tct('Remove Environment Variable [i]', {i})}
                  onClick={() => removeEnvVar(i)}
                />
              </ButtonHolder>
            </EnvironmentVariableWrapper>
          );
        })}
      </StyledPanelBody>
    </div>
  );
}

export default SentryFunctionEnvironmentVariables;

const EnvironmentVariableWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1.5fr min-content;
`;

const StyledAddButton = styled(Button)`
  float: right;
`;

const EnvHeader = styled('div')`
  text-align: left;
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.gray400};
`;

const EnvHeaderRight = styled(EnvHeader)`
  margin-left: -${space(2)};
`;

const ButtonHolder = styled('div')`
  align-items: center;
  display: flex;
  margin-bottom: ${space(2)};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
`;
