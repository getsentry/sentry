import React from 'react';
import styled from '@emotion/styled';

import {toggleKeyTransaction} from 'app/actionCreators/performance';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconStar} from 'app/icons';
import {Project, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

type Props = {
  api: Client;
  projects: Project[];
  /**
   * This prop is only used to seed the initial rendering state of this component.
   * After seeding the state, this value should not be used anymore.
   */
  isKeyTransaction: boolean;
  organization: Organization | undefined;
  projectSlug: string | undefined;
  transactionName: string | undefined;
};

type State = {
  isKeyTransaction: boolean;
};

class KeyTransactionField extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isKeyTransaction: !!props.isKeyTransaction,
    };
  }

  getProjectId(): number | null {
    const {projects, projectSlug} = this.props;
    const project = projects.find(proj => proj.slug === projectSlug);
    if (!project) {
      return null;
    }
    return parseInt(project.id, 10);
  }

  toggleKeyTransactionHandler = () => {
    const {api, organization, transactionName} = this.props;
    const {isKeyTransaction} = this.state;
    const projectId = this.getProjectId();

    // All the props are guaranteed to be not undefined at this point
    // as they have all been validated in the render method.
    toggleKeyTransaction(
      api,
      isKeyTransaction,
      organization!.slug,
      [projectId!],
      transactionName!
    ).then(() => {
      this.setState({
        isKeyTransaction: !isKeyTransaction,
      });
    });
  };

  render() {
    const {organization, projectSlug, transactionName} = this.props;
    const {isKeyTransaction} = this.state;

    const star = (
      <IconStar
        color={isKeyTransaction ? 'yellow400' : 'gray400'}
        isSolid={isKeyTransaction}
        data-test-id="key-transaction-column"
      />
    );

    // All these fields need to be defined in order to toggle a key transaction
    // Since they're not defined, we just render a plain star icon with no action
    // associated with it
    if (
      organization === undefined ||
      projectSlug === undefined ||
      transactionName === undefined ||
      this.getProjectId() === null
    ) {
      return star;
    }

    return (
      <StyledKey
        size="zero"
        borderless
        icon={star}
        onClick={this.toggleKeyTransactionHandler}
      />
    );
  }
}

const StyledKey = styled(Button)`
  width: 16px;
  vertical-align: middle;
`;

export default withApi(withProjects(KeyTransactionField));
