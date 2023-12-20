import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
  sourcePackageRegistries,
}: Partial<
  Pick<ModuleProps, 'dsn' | 'sourcePackageRegistries'>
> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'To add Sentry to your Rust project you just need to add a new dependency to your [code:Cargo.toml]:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'toml',
        partialLoading: sourcePackageRegistries?.isLoading,
        code: `
[dependencies]
sentry = "${
          sourcePackageRegistries?.isLoading
            ? t('\u2026loading')
            : sourcePackageRegistries?.data?.['sentry.rust']?.version ?? '0.31.5'
        }"
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          '[code:Sentry.init()] will return you a guard that when freed, will prevent process exit until all events have been sent (within a timeout):',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'rust',
        code: `
let _guard = sentry::init(("${dsn}", sentry::ClientOptions {
  release: sentry::release_name!(),
  ..Default::default()
}));
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'The quickest way to verify Sentry in your Rust application is to cause a panic:'
    ),
    configurations: [
      {
        language: 'rust',
        code: `
fn main() {
  let _guard = sentry::init(("${dsn}", sentry::ClientOptions {
    release: sentry::release_name!(),
    ..Default::default()
  }));

  // Sentry will capture this
  panic!("Everything is on fire!");
}
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithRust({
  dsn,
  sourcePackageRegistries,
  ...props
}: ModuleProps) {
  return <Layout steps={steps({dsn, sourcePackageRegistries})} {...props} />;
}

export default GettingStartedWithRust;
