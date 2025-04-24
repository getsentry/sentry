import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';
import * as qs from 'query-string';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import Form from 'sentry/components/forms/form';
// import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import FormModel from 'sentry/components/forms/model';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

type Installation = {
  id: number;
  login: string;
};

type Props = {
  installation_info: Installation[];
};

export default function GithubInstallationSelect({installation_info}: Props) {
  const [model] = useState<FormModel>(() => new FormModel());

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    const data = model.getData();
    addLoadingMessage(t('Submitting\u2026'));
    model.setFormSaving();
    const {
      location: {origin},
    } = window;
    // redirect to the extensions endpoint with the form fields as query params
    // this is needed so we don't restart the pipeline loading from the original
    // OrganizationIntegrationSetupView route
    const currentParams = new URLSearchParams(window.location.search);
    const newParams = {
      ...Object.fromEntries(currentParams),
      installation_id: data.installation_id,
    };
    const newUrl = `${origin}/extensions/github/setup/?${qs.stringify(newParams)}`;
    window.location.assign(newUrl);
  };

  const handleSelect = ({value}: {value: number}) => {
    model.setValue('installation_id', value);
  };

  const selectOptions = installation_info.map(({id, login}) => ({
    value: id,
    label: `${login} (Installation ${id})`,
  }));

  return (
    <Fragment>
      <HeaderWithHelp docsUrl="yadaydyayda github" />
      <StyledList symbol="colored-numeric">
        <ListItem>
          <h3>{t('Select a Github Installation')}</h3>
          <Form model={model} hideFooter>
            <CompactSelect
              onChange={handleSelect}
              options={selectOptions}
              triggerProps={{prefix: t('Installation'), size: 'xs'}}
              value={model.getValue('installation_id')}
            />
          </Form>
        </ListItem>
      </StyledList>
      <Observer>
        {() => (
          <FooterWithButtons
            buttonText={t('Next')}
            onClick={handleSubmit}
            disabled={model.isSaving || !model.getValue('installation_id')}
          />
        )}
      </Observer>
    </Fragment>
  );
}

const StyledList = styled(List)`
  padding: 100px 50px 50px 50px;
`;
