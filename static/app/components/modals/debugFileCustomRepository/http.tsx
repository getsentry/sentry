import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import ActionButton from 'sentry/components/actions/button';
import Button from 'sentry/components/button';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import SelectField from 'sentry/components/forms/selectField';
import {
  DEBUG_SOURCE_CASINGS,
  DEBUG_SOURCE_LAYOUTS,
  DEBUG_SOURCE_TYPES,
} from 'sentry/data/debugFileSources';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {INPUT_PADDING} from 'sentry/styles/input';
import space from 'sentry/styles/space';
import {uniqueId} from 'sentry/utils/guid';

const CLEAR_PASSWORD_BUTTON_SIZE = 22;
const PASSWORD_INPUT_PADDING_RIGHT = INPUT_PADDING + CLEAR_PASSWORD_BUTTON_SIZE;

type InitialData = {
  layout: {
    casing: keyof typeof DEBUG_SOURCE_CASINGS;
    type: keyof typeof DEBUG_SOURCE_LAYOUTS;
  };
  name: string;
  url: string;
  password?: {
    'hidden-secret': boolean;
  };
  username?: string;
};

type Data = Partial<Pick<InitialData, 'name' | 'url'>> &
  Omit<InitialData, 'name' | 'url' | 'password' | 'layout'> & {
    'layout.casing': keyof typeof DEBUG_SOURCE_CASINGS;
    'layout.type': keyof typeof DEBUG_SOURCE_LAYOUTS;
    password?: string;
  };

type SubmitData = Omit<Data, 'password' | 'name' | 'url'> &
  Pick<InitialData, 'name' | 'url'> & {
    id: string;
    password?:
      | {
          'hidden-secret': boolean;
        }
      | string;
  };

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer'> & {
  onSubmit: (data: SubmitData) => void;
  initialData?: InitialData;
};

function Http({Header, Body, Footer, onSubmit, ...props}: Props) {
  const initialData: Data = {
    name: props.initialData?.name,
    url: props.initialData?.url,
    username: props.initialData?.username,
    password: typeof props.initialData?.password === 'object' ? undefined : '',
    'layout.type': props.initialData?.layout.type ?? 'native',
    'layout.casing': props.initialData?.layout.casing ?? 'default',
  };

  const [data, setData] = useState<Data>(initialData);

  function isFormInvalid() {
    return !data.name || !data.url;
  }

  function formUnchanged() {
    return data === initialData;
  }

  function handleSubmit() {
    const validData = data as Omit<SubmitData, 'id'>;
    onSubmit({
      id: uniqueId(),
      name: validData.name,
      url: validData.url,
      'layout.type': validData['layout.type'],
      'layout.casing': validData['layout.casing'],
      username: validData.username,
      password:
        validData.password === undefined
          ? {'hidden-secret': true}
          : !validData.password
          ? undefined
          : validData.password,
    });
  }

  function handleClearPassword() {
    setData({...data, password: ''});
  }

  return (
    <Fragment>
      <Header closeButton>
        {initialData
          ? tct('Update [name] Repository', {name: DEBUG_SOURCE_TYPES.http})
          : tct('Add [name] Repository', {name: DEBUG_SOURCE_TYPES.http})}
      </Header>
      <Body>
        <Field
          label={t('Name')}
          inline={false}
          help={t('A display name for this repository')}
          flexibleControlStateSize
          stacked
          required
        >
          <Input
            type="text"
            name="name"
            placeholder={t('New Repository')}
            value={data.name}
            onChange={e =>
              setData({
                ...data,
                name: e.target.value,
              })
            }
          />
        </Field>
        <hr />
        <Field
          label={t('Download Url')}
          inline={false}
          help={t('Full URL to the symbol server')}
          flexibleControlStateSize
          stacked
          required
        >
          <Input
            type="text"
            name="url"
            placeholder="https://msdl.microsoft.com/download/symbols/"
            value={data.url}
            onChange={e =>
              setData({
                ...data,
                url: e.target.value,
              })
            }
          />
        </Field>
        <Field
          label={t('User')}
          inline={false}
          help={t('User for HTTP basic auth')}
          flexibleControlStateSize
          stacked
        >
          <Input
            type="text"
            name="username"
            placeholder="admin"
            value={data.username}
            onChange={e =>
              setData({
                ...data,
                username: e.target.value,
              })
            }
          />
        </Field>
        <Field
          label={t('Password')}
          inline={false}
          help={t('Password for HTTP basic auth')}
          flexibleControlStateSize
          stacked
        >
          <PasswordInput
            type={data.password === undefined ? 'text' : 'password'}
            name="url"
            placeholder={
              data.password === undefined ? t('(Password unchanged)') : 'open-sesame'
            }
            value={data.password}
            onChange={e =>
              setData({
                ...data,
                password: e.target.value,
              })
            }
          />
          {(data.password === undefined ||
            (typeof data.password === 'string' && !!data.password)) && (
            <ClearPasswordButton
              onClick={handleClearPassword}
              icon={<IconClose size="14px" />}
              size="xsmall"
              title={t('Clear password')}
              aria-label={t('Clear password')}
              borderless
            />
          )}
        </Field>
        <hr />
        <StyledSelectField
          name="layout.type"
          label={t('Directory Layout')}
          help={t('The layout of the folder structure.')}
          options={Object.keys(DEBUG_SOURCE_LAYOUTS).map(key => ({
            value: key,
            label: DEBUG_SOURCE_LAYOUTS[key],
          }))}
          value={data['layout.type']}
          onChange={value =>
            setData({
              ...data,
              ['layout.type']: value,
            })
          }
          inline={false}
          flexibleControlStateSize
          stacked
        />
        <StyledSelectField
          name="layout.casing"
          label={t('Path Casing')}
          help={t('The case of files and folders.')}
          options={Object.keys(DEBUG_SOURCE_CASINGS).map(key => ({
            value: key,
            label: DEBUG_SOURCE_CASINGS[key],
          }))}
          value={data['layout.casing']}
          onChange={value =>
            setData({
              ...data,
              ['layout.casing']: value,
            })
          }
          inline={false}
          flexibleControlStateSize
          stacked
        />
      </Body>
      <Footer>
        <Button
          onClick={handleSubmit}
          priority="primary"
          disabled={isFormInvalid() || formUnchanged()}
        >
          {t('Save changes')}
        </Button>
      </Footer>
    </Fragment>
  );
}

export default Http;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

const PasswordInput = styled(Input)`
  padding-right: ${PASSWORD_INPUT_PADDING_RIGHT}px;
`;

const ClearPasswordButton = styled(ActionButton)`
  background: transparent;
  height: ${CLEAR_PASSWORD_BUTTON_SIZE}px;
  width: ${CLEAR_PASSWORD_BUTTON_SIZE}px;
  padding: 0;
  position: absolute;
  top: 50%;
  right: ${space(0.75)};
  transform: translateY(-50%);
  svg {
    color: ${p => p.theme.gray400};
    :hover {
      color: hsl(0, 0%, 60%);
    }
  }
`;
