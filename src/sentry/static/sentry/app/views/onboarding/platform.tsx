import React from 'react';
import {motion} from 'framer-motion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {createProject} from 'app/actionCreators/projects';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import PlatformPicker from 'app/components/platformPicker';
import {PlatformKey} from 'app/data/platformCategories';
import {t, tct} from 'app/locale';
import {Team} from 'app/types';
import withApi from 'app/utils/withApi';
import withTeams from 'app/utils/withTeams';

import StepHeading from './components/stepHeading';
import {StepProps} from './types';

type Props = StepProps & {
  api: Client;
  teams: Team[];
};

type State = {
  /**
   * This will be flipped to true immediately before creating the first
   * project. We use state here to avoid the intermittent prop value where
   * the project is created but the store hasn't propagated its value to the
   * component yet, leaving a brief period where the button will flash
   * between labels / disabled states.
   */
  firstProjectCreated: boolean;
  /**
   * `progressing` indicates that we are moving to the next step. Again, this
   * is kept as state to avoid intermittent states causing flickering of the
   * button.
   */
  progressing: boolean;
};

class OnboardingPlatform extends React.Component<Props, State> {
  state: State = {
    firstProjectCreated: false,
    progressing: false,
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.active && !this.props.active) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({progressing: false});
    }
  }

  get hasFirstProject() {
    return this.props.project || this.state.firstProjectCreated;
  }

  get contineButtonLabel() {
    if (this.state.progressing) {
      return t('Creating Project...');
    }
    if (!this.hasFirstProject) {
      return t('Create Project');
    }
    if (!this.props.active) {
      return t('Project Created');
    }
    return t('Setup Your Project');
  }

  async createFirstProject(platform: PlatformKey) {
    const {api, orgId, teams} = this.props;

    if (this.hasFirstProject) {
      return;
    }

    if (teams.length < 1) {
      return;
    }

    this.setState({firstProjectCreated: true});

    try {
      const data = await createProject(api, orgId, teams[0].slug, orgId, platform, {
        defaultRules: false,
      });
      ProjectActions.createSuccess(data);
    } catch (error) {
      addErrorMessage(t('Failed to create project'));
      throw error;
    }
  }

  handleSetPlatform = (platform: PlatformKey | null) => this.props.onUpdate({platform});

  handleContinue = async () => {
    this.setState({progressing: true});
    const {platform} = this.props;

    if (platform === null) {
      return;
    }

    // Create their first project if they don't already have one. This is a
    // no-op if they already have a project.
    await this.createFirstProject(platform);
    this.props.onComplete({});
  };

  render() {
    const {active, project, platform} = this.props;

    const selectedPlatform = platform || (project && project.platform);

    const continueDisabled = this.state.progressing || (this.hasFirstProject && !active);

    return (
      <div>
        <StepHeading step={1}>Choose your project’s platform</StepHeading>
        <motion.div
          variants={{
            initial: {y: 30, opacity: 0},
            animate: {y: 0, opacity: 1},
            exit: {opacity: 0},
          }}
        >
          <p>
            {tct(
              `Variety is the spice of application monitoring. Sentry SDKs integrate
             with most languages and platforms your developer heart desires.
             [link:View the full list].`,
              {link: <ExternalLink href="https://docs.sentry.io/platforms/" />}
            )}
          </p>
          <PlatformPicker
            noAutoFilter
            platform={selectedPlatform}
            setPlatform={this.handleSetPlatform}
          />
          <p>
            {tct(
              `Don't see your platform-of-choice? Fear not. Select
               [otherPlatformLink:other platform] to use a [communityClient:community client].
               Need help? Learn more in [docs:our docs].`,
              {
                otherPlatformLink: (
                  <Button
                    priority="link"
                    onClick={() => this.handleSetPlatform('other')}
                  />
                ),
                communityClient: (
                  <ExternalLink href="https://docs.sentry.io/platforms/#community-supported" />
                ),
                docs: <ExternalLink href="https://docs.sentry.io/platforms/" />,
              }
            )}
          </p>
          {selectedPlatform && (
            <Button
              data-test-id="platform-select-next"
              priority="primary"
              disabled={continueDisabled}
              onClick={this.handleContinue}
            >
              {this.contineButtonLabel}
            </Button>
          )}
        </motion.div>
      </div>
    );
  }
}

export default withApi(withTeams(OnboardingPlatform));
