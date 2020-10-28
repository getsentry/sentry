import React from 'react';

import ConfigStore from 'app/stores/configStore';
import {Organization} from 'app/types';
import {experimentConfig, unassignedValue} from 'app/data/experimentConfig';
import getDisplayName from 'app/utils/getDisplayName';
import {logExperiment} from 'app/utils/analytics';
import {
  Experiments,
  ExperimentKey,
  ExperimentAssignment,
  ExperimentType,
  OrgExperiments,
  UserExperiments,
} from 'app/types/experiments';

type Options<E extends ExperimentKey, L extends boolean> = {
  /**
   * The key of the experiment that will be injected into the component
   */
  experiment: E;
  /**
   * By default this HoC will log the exposure of the experiment upon mounting
   * of the component.
   *
   * If this is undesirable, for example if the experiment is hidden behind
   * some user action beyond this component being mounted, then you will want
   * to customize when exposure to the experiment has been logged.
   *
   * Marking this value as true will inject a `logExperiment` function as a
   * prop which takes no parameters and will log exposure of the experiment
   * when called.
   *
   * NOTE: If set to true, YOU ARE RESPONSIBLE for logging exposure of the
   *       experiment!! If you do not log exposure your experiment will not be
   *       correct!!
   */
  injectLogExperiment?: L;
};

type ExpectedProps<T extends ExperimentType> = T extends 'organization'
  ? {organization: Organization}
  : {};

type InjectedExperimentProps<E extends ExperimentKey, L extends boolean> = {
  /**
   * The value of the injected experiment. Use this to determine behavior of
   * your component depending on the value.
   */
  experimentAssignment: ExperimentAssignment[E];
} & (L extends true ? LogExperimentProps : {});

type LogExperimentProps = {
  /**
   * Call this method when the user has been exposed to the experiment this
   * component has been provided the value of.
   */
  logExperiment: () => void;
};

/**
 * A HoC wrapper that injects `experimentAssignment` into a component
 *
 * This wrapper will automatically log exposure of the experiment upon
 * receiving the componentDidMount lifecycle event.
 *
 * For organization experiments, an organization object must be provided to the
 * component. You may wish to use the withOrganization HoC for this.
 *
 * If exposure logging upon mount is not desirable, The `injectLogExperiment`
 * option may be of use.
 *
 * NOTE: When using this you will have to type the `experimentAssignment` prop
 *       on your component. For this you should use the `ExperimentAssignment`
 *       mapped type.
 */
function withExperiment<
  E extends ExperimentKey,
  L extends boolean,
  P extends InjectedExperimentProps<E, L>
>(Component: React.ComponentType<P>, {experiment, injectLogExperiment}: Options<E, L>) {
  type Props = Omit<P, keyof InjectedExperimentProps<E, L>> &
    ExpectedProps<Experiments[E]['type']>;

  return class extends React.Component<Props> {
    static displayName = `withExperiment[${experiment}](${getDisplayName(Component)})`;

    // NOTE(ts): Because of the type complexity of this HoC, typescript
    // has a hard time understanding how to narrow Experiments[E]['type']
    // when we type assert on it.
    //
    // This means we have to do some typecasting to massage things into working
    // as expected.
    //
    // We DO guarantee the external API of this HoC is typed accurately.

    componentDidMount() {
      if (!injectLogExperiment) {
        this.logExperiment();
      }
    }

    getProps<P extends ExperimentType>() {
      return (this.props as unknown) as ExpectedProps<P>;
    }

    get config() {
      return experimentConfig[experiment];
    }

    get experimentAssignment() {
      const {type} = this.config;

      if (type === ExperimentType.Organization) {
        const key = experiment as keyof OrgExperiments;
        return this.getProps<typeof type>().organization.experiments[key];
      }

      if (type === ExperimentType.User) {
        const key = experiment as keyof UserExperiments;
        return ConfigStore.get('user').experiments[key];
      }

      return unassignedValue;
    }

    logExperiment = () =>
      logExperiment({
        key: experiment,
        organization: this.getProps<ExperimentType.Organization>().organization,
      });

    render() {
      const WrappedComponent = Component as React.JSXElementConstructor<any>;

      const props = {
        experimentAssignment: this.experimentAssignment,
        ...(injectLogExperiment ? {logExperiment: this.logExperiment} : {}),
        ...this.props,
      } as unknown;

      return <WrappedComponent {...(props as P)} />;
    }
  };
}

export default withExperiment;
