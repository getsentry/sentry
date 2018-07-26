import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {fetchOrganizationEnvironments} from 'app/actionCreators/environments';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import DropdownLink from 'app/components/dropdownLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import MultiSelectField from 'app/components/forms/multiSelectField';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

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
      <Flex direction="column" justify="center" className={className}>
        <label>{t('Environment')}</label>
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
                        choices={environments.map(env => [env.id, env.name])}
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
      </Flex>
    );
  }
}

const StyledMultipleEnvironmentSelector = styled(withApi(MultipleEnvironmentSelector))`
  text-align: right;
  label {
    font-weight: 400;
    font-size: 13px;
    color: #afa3bb;
    margin-bottom: 12px;
  }
  .dropdown-actor-title {
    font-size: 15px;
    height: auto;
    color: ${p => p.theme.button.default.colorActive};
  }
`;

export default StyledMultipleEnvironmentSelector;

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
