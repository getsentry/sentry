import type {
  ExperimentAssignment,
  ExperimentKey,
  Experiments,
  ExperimentType,
} from 'sentry/types/experiments';
import type {Organization} from 'sentry/types/organization';
import {useExperiment} from 'sentry/utils/useExperiment';

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
  : never;

type InjectedExperimentProps<E extends ExperimentKey, L extends boolean> = {
  /**
   * The value of the injected experiment. Use this to determine behavior of
   * your component depending on the value.
   */
  experimentAssignment: ExperimentAssignment[E];
} & (L extends true ? LogExperimentProps : never);

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
  P extends InjectedExperimentProps<E, L>,
>(
  ExperimentComponent: React.ComponentType<P>,
  {experiment, injectLogExperiment}: Options<E, L>
) {
  type Props = Omit<P, keyof InjectedExperimentProps<E, L>> &
    ExpectedProps<Experiments[E]['type']>;

  return function (incomingProps: Props) {
    // NOTE(ts): Because of the type complexity of this HoC, typescript
    // has a hard time understanding how to narrow Experiments[E]['type']
    // when we type assert on it.
    //
    // This means we have to do some typecasting to massage things into working
    // as expected.
    //
    // We DO guarantee the external API of this HoC is typed accurately.

    const WrappedComponent = ExperimentComponent as React.JSXElementConstructor<any>;

    const {experimentAssignment, logExperiment} = useExperiment(experiment, {
      logExperimentOnMount: !injectLogExperiment,
    });

    const props = {
      experimentAssignment,
      ...(injectLogExperiment ? {logExperiment} : {}),
      ...incomingProps,
    } as unknown;

    return <WrappedComponent {...(props as P)} />;
  };
}

export default withExperiment;
