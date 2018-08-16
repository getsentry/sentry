import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {fetchOrganizationEnvironments} from 'app/actionCreators/environments';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import DropdownLink from 'app/components/dropdownLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import MultiSelectField from 'app/components/forms/multiSelectField';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

import HeaderItem from './headerItem';

/**
 * Environment Selector
 */
class MultipleEnvironmentSelector extends React.Component {
  static propTypes = {
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
    organization: SentryTypes.Organization,

    // This component must be controlled using a value array
    value: PropTypes.array,
  };

  static defaultProps = {};

  handleUpdate = e => {
    let {onUpdate} = this.props;

    if (typeof onUpdate !== 'function') return;
    onUpdate(this.props.value);
  };

  render() {
    const {className, value, onChange, organization} = this.props;
    const summary = value && value.length ? `${value.join(', ')}` : t('All Environments');

    return (
      <HeaderItem label={t('Environment')} className={className}>
        <DropdownLink
          title={summary}
          alwaysRenderMenu={false}
          keepMenuOpen={true}
          anchorRight={true}
        >
          <Box p={2}>
            <FetchOrganizationEnvironments organization={organization}>
              {({environments}) => (
                <React.Fragment>
                  {environments === null && <LoadingIndicator />}
                  {!!environments && (
                    <React.Fragment>
                      <MultiSelectField
                        name="environments"
                        value={value}
                        choices={environments.map(env => [env.name, env.name])}
                        onChange={onChange}
                      />
                    </React.Fragment>
                  )}
                  <Button data-test-id="update-envs" onClick={this.handleUpdate}>
                    {t('Update')}
                  </Button>
                </React.Fragment>
              )}
            </FetchOrganizationEnvironments>
          </Box>
        </DropdownLink>
      </HeaderItem>
    );
  }
}

export default withApi(MultipleEnvironmentSelector);

const FetchOrganizationEnvironments = withApi(
  class FetchOrganizationEnvironments extends React.Component {
    static propTypes = {
      api: PropTypes.object,
      organization: SentryTypes.Organization,
    };
    constructor(props) {
      super(props);
      this.state = {
        environments: null,
      };
    }

    componentDidMount() {
      let {api, organization} = this.props;
      fetchOrganizationEnvironments(api, organization.slug).then(environments =>
        this.setState({environments})
      );
    }
    render() {
      let {children} = this.props;
      return children({
        environments: this.state.environments,
      });
    }
  }
);
