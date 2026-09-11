/**
 * GENERATED FILE. Do not edit manually.
 * To update it run `make build-api-contracts`
 *
 * Response types for Sentry API endpoints, derived from the backend's
 * response TypedDicts and serializers via the internal OpenAPI spec.
 *
 * DEPLOYMENT: This is safe to deploy alongside backend changes.
 */

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type ActionFilterValidator = {
  actions: Array<Record<string, unknown>>;
  logic_type: 'any' | 'any-short' | 'all' | 'none';
  conditions?: unknown[];
  id?: number;
};

export type AgentApprovalRequest = {
  scopes: string[];
  sessionId: string;
};

export type AgentApprovalResponse = {
  expiresAt: string;
  scopes: string[];
  status: 'approved';
};

export type AgentTokenRequest = {
  sessionId: string;
  requestedScopes?: string[];
};

export type AgentTokenResponse = {
  expiresAt: string;
  scopes: string[];
  token: string;
};

export type AgenticOnboardingRun = {
  channelId: string;
  clientRunId: string;
  continueUpdates: boolean;
  createdAt: string;
  expiresAt: string;
  runId: string;
  runStatus: 'active' | 'completed' | 'failed' | 'cancelled';
  schemaVersion: number;
  sequence: number;
  stages: Array<{
    eventNote: string | null;
    extra: Record<string, unknown> | null;
    stage:
      | 'connect_mcp'
      | 'analyze_project'
      | 'create_project'
      | 'instrument_app'
      | 'plan_test_error'
      | 'send_verification_error'
      | 'receive_verification_error'
      | 'prepare_production'
      | 'check_stack_trace_quality';
    status: 'active' | 'waiting' | 'completed' | 'skipped' | 'bypassed' | 'failed' | null;
  }>;
  updatedAt: string;
  onboardingCode?: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AgenticOnboardingRunRequest = {
  client_run_id: string;
  onboarding_code: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AgenticOnboardingStatusRequest = {
  run_token: string;
  schema_version: number;
  stage:
    | 'connect_mcp'
    | 'analyze_project'
    | 'create_project'
    | 'instrument_app'
    | 'plan_test_error'
    | 'send_verification_error'
    | 'receive_verification_error'
    | 'prepare_production'
    | 'check_stack_trace_quality';
  status: 'active' | 'waiting' | 'completed' | 'skipped' | 'failed';
  event_note?: string;
  extra?: Record<string, unknown>;
  run_status?: 'completed' | 'failed';
};

export type AggregateField = {
  chartType?: number;
  groupBy?: string;
  yAxes?: string[];
};

/**
 * Serializer for creating/updating an alert rule. Required context:
 *  - `organization`: The organization related to this alert rule.
 *  - `access`: An access object (from `request.access`)
 *  - `user`: The user from `request.user`
 */
export type AlertRule = {
  aggregate: string;
  name: string;
  query: string;
  threshold_type: number | null;
  time_window: number;
  triggers: unknown[];
  comparison_delta?: number | null;
  dataset?: string;
  description?: string;
  detection_type?: string;
  environment?: string | null;
  event_types?: string[];
  extrapolation_mode?: string | null;
  owner?: string | null;
  projects?: string[];
  query_type?: number;
  resolve_threshold?: number | null;
  seasonality?: string | null;
  sensitivity?: string | null;
  threshold_period?: number;
};

export type AlertRuleDetector = {
  alertRuleId: string | null;
  detectorId: string;
  ruleId: string | null;
};

export type AlertRuleWorkflow = {
  alertRuleId: string | null;
  ruleId: string | null;
  workflowId: string;
};

export type AuthDetail = {
  detail: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AuthLoginRequest = {
  password: string;
  username: string;
  org_slug?: string | null;
};

export type AuthMfaChallenge =
  | {
      challenge: {
        webAuthnAuthenticationData: string;
      };
      method: 'u2f';
    }
  | {
      expiresIn: number;
      method: 'sms';
    };

export type AuthMfaRequired = {
  mfaMethods: Array<
    | {
        id: 'totp' | 'sms' | 'recovery';
      }
    | {
        id: 'u2f';
      }
  >;
  mfaRequired: boolean;
};

export type AuthOrganizationConfig = {
  authenticated: boolean;
  canRegister: boolean;
  joinRequestUrl: string | null;
  loginMethod: 'password' | 'sso';
  memberAuthenticated: boolean;
  organization: {
    avatarUrl: string | null;
    name: string;
    slug: string;
  };
  provider: {
    key: string;
    name: string;
  } | null;
  ssoRequired: boolean;
  warnings: string[];
};

export type AuthRecoveryAccepted = {
  detail: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AuthRecoveryConfirmRequest = {
  password: string;
  token: string;
  user_id: number;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AuthRecoveryRequest = {
  user: string;
};

export type AuthSuccess = {
  nextUri: string;
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    permissions: string[];
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  };
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AuthTwoFactorChallengeRequest = {
  method: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AuthTwoFactorRequest = {
  method: string;
  otp?: string;
  response?: AuthWebAuthnResponse;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type AuthWebAuthnResponse = {
  authenticator_data: string;
  client_data: string;
  key_handle: string;
  signature_data: string;
};

/** Response type for the POST endpoint (default kickoff and step paths). */
export type AutofixPostResponse = {
  run_id: number;
  sentry_run_id: string | null;
};

/** Response type for the GET endpoint */
export type AutofixStateResponse = {
  autofix: Record<string, unknown> | null;
  formatted?: {
    content: string;
    format: 'markdown' | 'xml' | 'json';
  };
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type BaseDataConditionGroupValidator = {
  logic_type: 'any' | 'any-short' | 'all' | 'none';
  conditions?: unknown[];
  id?: number;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type BaseDetectorTypeValidator = {
  name: string;
  type: string;
  condition_group?: BaseDataConditionGroupValidator;
  config?: Record<string, unknown>;
  data_sources?: unknown[];
  description?: string | null;
  enabled?: boolean;
  owner?: string | null;
  workflow_ids?: number[];
};

export type BaseTeam = {
  access: string[];
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string | null;
  flags: Record<string, unknown>;
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
  teamRole: string | null;
};

export type BulkEnvironment = {
  environmentNames: string[];
  isHidden: boolean;
};

export type BulkUpdateAlerts = {
  enabled: boolean;
};

export type BulkUpdateMonitors = {
  enabled: boolean;
};

export type BulkUpdateProjectEnvironments = Array<{
  id: string;
  isHidden: boolean;
  name: string;
}>;

export type CheckInList = Array<{
  dateAdded: string;
  dateClock: string;
  dateCreated: string;
  dateInProgress: string | null;
  dateUpdated: string;
  duration: number | null;
  environment: string;
  expectedTime: string;
  id: string;
  monitorConfig: {
    alert_rule_id: number | null;
    checkin_margin: number | null;
    failure_issue_threshold: number | null;
    max_runtime: number | null;
    recovery_threshold: number | null;
    schedule: string | number[];
    schedule_type: 'crontab' | 'interval';
    timezone: string | null;
  };
  status: string;
  groups?: string[];
}>;

export type CheckinProcessingError = Array<{
  checkin: {
    message: {
      message_type: 'check_in';
      payload: string;
      project_id: number;
      retention_days: number;
      start_time: number;
      sdk?: string | null;
    };
    partition: number;
    payload: {
      check_in_id: string;
      contexts: {
        trace: {
          trace_id: string;
        };
      };
      duration: number;
      environment: string;
      monitor_config: Record<string, unknown>;
      monitor_slug: string;
      status: string;
    };
    ts: string;
  };
  errors: Array<
    | {
        existingEnvironment: string;
        type: 0;
      }
    | {
        type: 1;
      }
    | {
        guid: string;
        type: 2;
      }
    | {
        duration: string;
        type: 3;
      }
    | {
        type: 4;
      }
    | {
        errors: Record<string, string[]>;
        type: 5;
      }
    | {
        type: 6;
      }
    | {
        type: 7;
      }
    | {
        errors: Record<string, string[]>;
        type: 8;
      }
    | {
        reason: string;
        type: 9;
      }
    | {
        reason: string;
        type: 10;
      }
    | {
        type: 11;
      }
    | {
        type: 12;
      }
    | {
        reason: string;
        type: 13;
      }
    | {
        type: 14;
      }
    | {
        type: 15;
      }
  >;
  id: string;
}>;

export type Commit = {
  id: string;
  author_email?: string | null;
  author_name?: string | null;
  message?: string | null;
  patch_set?: CommitPatchSet[] | null;
  repository?: string | null;
  timestamp?: string | null;
};

export type CommitPatchSet = {
  path: string;
  type: string;
};

export type CommitSerializerResponse = Array<{
  dateCreated: string;
  id: string;
  message: string | null;
  pullRequest: {
    author:
      | {
          avatarUrl: string;
          dateJoined: string;
          email: string;
          emails: Array<{
            email: string;
            id: string;
            is_verified: boolean;
          }>;
          experiments: Record<string, unknown>;
          has2fa: boolean;
          hasPasswordAuth: boolean;
          id: string;
          isActive: boolean;
          isManaged: boolean;
          isStaff: boolean;
          isSuperuser: boolean;
          isSuspended: boolean;
          lastActive: string | null;
          lastLogin: string | null;
          name: string;
          username: string;
          authenticators?: unknown[];
          avatar?: {
            avatarType?: string;
            avatarUrl?: string | null;
            avatarUuid?: string | null;
          };
          canReset2fa?: boolean;
          identities?: Array<{
            dateSynced: string;
            dateVerified: string;
            id: string;
            name: string;
            organization: {
              name: string;
              slug: string;
            };
            provider: {
              id: string;
              name: string;
            };
          }>;
        }
      | {
          email: string;
          name: string | null;
        };
    dateCreated: string;
    externalUrl: string;
    id: string;
    mergedAt: string | null;
    message: string | null;
    repository: {
      dateCreated: string;
      id: string;
      name: string;
      externalId?: string | null;
      externalSlug?: string | null;
      integrationId?: string | null;
      provider?: Record<string, string>;
      settings?: {
        codeReviewTriggers: string[];
        enabledCodeReview: boolean;
      } | null;
      status?: string;
      url?: string | null;
    };
    status: 'merged' | 'open' | 'closed' | 'draft' | 'unknown' | null;
    title: string | null;
  } | null;
  suspectCommitType: string;
  author?:
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
    | Record<string, never>;
  repository?: {
    dateCreated: string;
    id: string;
    name: string;
    externalId?: string | null;
    externalSlug?: string | null;
    integrationId?: string | null;
    provider?: Record<string, string>;
    settings?: {
      codeReviewTriggers: string[];
      enabledCodeReview: boolean;
    } | null;
    status?: string;
    url?: string | null;
  };
}>;

export type ConfigValidator = {
  schedule: unknown;
  checkin_margin?: number | null;
  failure_issue_threshold?: number | null;
  max_runtime?: number | null;
  recovery_threshold?: number | null;
  schedule_type?: 'crontab' | 'interval';
  timezone?:
    | 'Africa/Abidjan'
    | 'Africa/Accra'
    | 'Africa/Addis_Ababa'
    | 'Africa/Algiers'
    | 'Africa/Asmara'
    | 'Africa/Asmera'
    | 'Africa/Bamako'
    | 'Africa/Bangui'
    | 'Africa/Banjul'
    | 'Africa/Bissau'
    | 'Africa/Blantyre'
    | 'Africa/Brazzaville'
    | 'Africa/Bujumbura'
    | 'Africa/Cairo'
    | 'Africa/Casablanca'
    | 'Africa/Ceuta'
    | 'Africa/Conakry'
    | 'Africa/Dakar'
    | 'Africa/Dar_es_Salaam'
    | 'Africa/Djibouti'
    | 'Africa/Douala'
    | 'Africa/El_Aaiun'
    | 'Africa/Freetown'
    | 'Africa/Gaborone'
    | 'Africa/Harare'
    | 'Africa/Johannesburg'
    | 'Africa/Juba'
    | 'Africa/Kampala'
    | 'Africa/Khartoum'
    | 'Africa/Kigali'
    | 'Africa/Kinshasa'
    | 'Africa/Lagos'
    | 'Africa/Libreville'
    | 'Africa/Lome'
    | 'Africa/Luanda'
    | 'Africa/Lubumbashi'
    | 'Africa/Lusaka'
    | 'Africa/Malabo'
    | 'Africa/Maputo'
    | 'Africa/Maseru'
    | 'Africa/Mbabane'
    | 'Africa/Mogadishu'
    | 'Africa/Monrovia'
    | 'Africa/Nairobi'
    | 'Africa/Ndjamena'
    | 'Africa/Niamey'
    | 'Africa/Nouakchott'
    | 'Africa/Ouagadougou'
    | 'Africa/Porto-Novo'
    | 'Africa/Sao_Tome'
    | 'Africa/Timbuktu'
    | 'Africa/Tripoli'
    | 'Africa/Tunis'
    | 'Africa/Windhoek'
    | 'America/Adak'
    | 'America/Anchorage'
    | 'America/Anguilla'
    | 'America/Antigua'
    | 'America/Araguaina'
    | 'America/Argentina/Buenos_Aires'
    | 'America/Argentina/Catamarca'
    | 'America/Argentina/ComodRivadavia'
    | 'America/Argentina/Cordoba'
    | 'America/Argentina/Jujuy'
    | 'America/Argentina/La_Rioja'
    | 'America/Argentina/Mendoza'
    | 'America/Argentina/Rio_Gallegos'
    | 'America/Argentina/Salta'
    | 'America/Argentina/San_Juan'
    | 'America/Argentina/San_Luis'
    | 'America/Argentina/Tucuman'
    | 'America/Argentina/Ushuaia'
    | 'America/Aruba'
    | 'America/Asuncion'
    | 'America/Atikokan'
    | 'America/Atka'
    | 'America/Bahia'
    | 'America/Bahia_Banderas'
    | 'America/Barbados'
    | 'America/Belem'
    | 'America/Belize'
    | 'America/Blanc-Sablon'
    | 'America/Boa_Vista'
    | 'America/Bogota'
    | 'America/Boise'
    | 'America/Buenos_Aires'
    | 'America/Cambridge_Bay'
    | 'America/Campo_Grande'
    | 'America/Cancun'
    | 'America/Caracas'
    | 'America/Catamarca'
    | 'America/Cayenne'
    | 'America/Cayman'
    | 'America/Chicago'
    | 'America/Chihuahua'
    | 'America/Ciudad_Juarez'
    | 'America/Coral_Harbour'
    | 'America/Cordoba'
    | 'America/Costa_Rica'
    | 'America/Coyhaique'
    | 'America/Creston'
    | 'America/Cuiaba'
    | 'America/Curacao'
    | 'America/Danmarkshavn'
    | 'America/Dawson'
    | 'America/Dawson_Creek'
    | 'America/Denver'
    | 'America/Detroit'
    | 'America/Dominica'
    | 'America/Edmonton'
    | 'America/Eirunepe'
    | 'America/El_Salvador'
    | 'America/Ensenada'
    | 'America/Fort_Nelson'
    | 'America/Fort_Wayne'
    | 'America/Fortaleza'
    | 'America/Glace_Bay'
    | 'America/Godthab'
    | 'America/Goose_Bay'
    | 'America/Grand_Turk'
    | 'America/Grenada'
    | 'America/Guadeloupe'
    | 'America/Guatemala'
    | 'America/Guayaquil'
    | 'America/Guyana'
    | 'America/Halifax'
    | 'America/Havana'
    | 'America/Hermosillo'
    | 'America/Indiana/Indianapolis'
    | 'America/Indiana/Knox'
    | 'America/Indiana/Marengo'
    | 'America/Indiana/Petersburg'
    | 'America/Indiana/Tell_City'
    | 'America/Indiana/Vevay'
    | 'America/Indiana/Vincennes'
    | 'America/Indiana/Winamac'
    | 'America/Indianapolis'
    | 'America/Inuvik'
    | 'America/Iqaluit'
    | 'America/Jamaica'
    | 'America/Jujuy'
    | 'America/Juneau'
    | 'America/Kentucky/Louisville'
    | 'America/Kentucky/Monticello'
    | 'America/Knox_IN'
    | 'America/Kralendijk'
    | 'America/La_Paz'
    | 'America/Lima'
    | 'America/Los_Angeles'
    | 'America/Louisville'
    | 'America/Lower_Princes'
    | 'America/Maceio'
    | 'America/Managua'
    | 'America/Manaus'
    | 'America/Marigot'
    | 'America/Martinique'
    | 'America/Matamoros'
    | 'America/Mazatlan'
    | 'America/Mendoza'
    | 'America/Menominee'
    | 'America/Merida'
    | 'America/Metlakatla'
    | 'America/Mexico_City'
    | 'America/Miquelon'
    | 'America/Moncton'
    | 'America/Monterrey'
    | 'America/Montevideo'
    | 'America/Montreal'
    | 'America/Montserrat'
    | 'America/Nassau'
    | 'America/New_York'
    | 'America/Nipigon'
    | 'America/Nome'
    | 'America/Noronha'
    | 'America/North_Dakota/Beulah'
    | 'America/North_Dakota/Center'
    | 'America/North_Dakota/New_Salem'
    | 'America/Nuuk'
    | 'America/Ojinaga'
    | 'America/Panama'
    | 'America/Pangnirtung'
    | 'America/Paramaribo'
    | 'America/Phoenix'
    | 'America/Port-au-Prince'
    | 'America/Port_of_Spain'
    | 'America/Porto_Acre'
    | 'America/Porto_Velho'
    | 'America/Puerto_Rico'
    | 'America/Punta_Arenas'
    | 'America/Rainy_River'
    | 'America/Rankin_Inlet'
    | 'America/Recife'
    | 'America/Regina'
    | 'America/Resolute'
    | 'America/Rio_Branco'
    | 'America/Rosario'
    | 'America/Santa_Isabel'
    | 'America/Santarem'
    | 'America/Santiago'
    | 'America/Santo_Domingo'
    | 'America/Sao_Paulo'
    | 'America/Scoresbysund'
    | 'America/Shiprock'
    | 'America/Sitka'
    | 'America/St_Barthelemy'
    | 'America/St_Johns'
    | 'America/St_Kitts'
    | 'America/St_Lucia'
    | 'America/St_Thomas'
    | 'America/St_Vincent'
    | 'America/Swift_Current'
    | 'America/Tegucigalpa'
    | 'America/Thule'
    | 'America/Thunder_Bay'
    | 'America/Tijuana'
    | 'America/Toronto'
    | 'America/Tortola'
    | 'America/Vancouver'
    | 'America/Virgin'
    | 'America/Whitehorse'
    | 'America/Winnipeg'
    | 'America/Yakutat'
    | 'America/Yellowknife'
    | 'Antarctica/Casey'
    | 'Antarctica/Davis'
    | 'Antarctica/DumontDUrville'
    | 'Antarctica/Macquarie'
    | 'Antarctica/Mawson'
    | 'Antarctica/McMurdo'
    | 'Antarctica/Palmer'
    | 'Antarctica/Rothera'
    | 'Antarctica/South_Pole'
    | 'Antarctica/Syowa'
    | 'Antarctica/Troll'
    | 'Antarctica/Vostok'
    | 'Arctic/Longyearbyen'
    | 'Asia/Aden'
    | 'Asia/Almaty'
    | 'Asia/Amman'
    | 'Asia/Anadyr'
    | 'Asia/Aqtau'
    | 'Asia/Aqtobe'
    | 'Asia/Ashgabat'
    | 'Asia/Ashkhabad'
    | 'Asia/Atyrau'
    | 'Asia/Baghdad'
    | 'Asia/Bahrain'
    | 'Asia/Baku'
    | 'Asia/Bangkok'
    | 'Asia/Barnaul'
    | 'Asia/Beirut'
    | 'Asia/Bishkek'
    | 'Asia/Brunei'
    | 'Asia/Calcutta'
    | 'Asia/Chita'
    | 'Asia/Choibalsan'
    | 'Asia/Chongqing'
    | 'Asia/Chungking'
    | 'Asia/Colombo'
    | 'Asia/Dacca'
    | 'Asia/Damascus'
    | 'Asia/Dhaka'
    | 'Asia/Dili'
    | 'Asia/Dubai'
    | 'Asia/Dushanbe'
    | 'Asia/Famagusta'
    | 'Asia/Gaza'
    | 'Asia/Harbin'
    | 'Asia/Hebron'
    | 'Asia/Ho_Chi_Minh'
    | 'Asia/Hong_Kong'
    | 'Asia/Hovd'
    | 'Asia/Irkutsk'
    | 'Asia/Istanbul'
    | 'Asia/Jakarta'
    | 'Asia/Jayapura'
    | 'Asia/Jerusalem'
    | 'Asia/Kabul'
    | 'Asia/Kamchatka'
    | 'Asia/Karachi'
    | 'Asia/Kashgar'
    | 'Asia/Kathmandu'
    | 'Asia/Katmandu'
    | 'Asia/Khandyga'
    | 'Asia/Kolkata'
    | 'Asia/Krasnoyarsk'
    | 'Asia/Kuala_Lumpur'
    | 'Asia/Kuching'
    | 'Asia/Kuwait'
    | 'Asia/Macao'
    | 'Asia/Macau'
    | 'Asia/Magadan'
    | 'Asia/Makassar'
    | 'Asia/Manila'
    | 'Asia/Muscat'
    | 'Asia/Nicosia'
    | 'Asia/Novokuznetsk'
    | 'Asia/Novosibirsk'
    | 'Asia/Omsk'
    | 'Asia/Oral'
    | 'Asia/Phnom_Penh'
    | 'Asia/Pontianak'
    | 'Asia/Pyongyang'
    | 'Asia/Qatar'
    | 'Asia/Qostanay'
    | 'Asia/Qyzylorda'
    | 'Asia/Rangoon'
    | 'Asia/Riyadh'
    | 'Asia/Saigon'
    | 'Asia/Sakhalin'
    | 'Asia/Samarkand'
    | 'Asia/Seoul'
    | 'Asia/Shanghai'
    | 'Asia/Singapore'
    | 'Asia/Srednekolymsk'
    | 'Asia/Taipei'
    | 'Asia/Tashkent'
    | 'Asia/Tbilisi'
    | 'Asia/Tehran'
    | 'Asia/Tel_Aviv'
    | 'Asia/Thimbu'
    | 'Asia/Thimphu'
    | 'Asia/Tokyo'
    | 'Asia/Tomsk'
    | 'Asia/Ujung_Pandang'
    | 'Asia/Ulaanbaatar'
    | 'Asia/Ulan_Bator'
    | 'Asia/Urumqi'
    | 'Asia/Ust-Nera'
    | 'Asia/Vientiane'
    | 'Asia/Vladivostok'
    | 'Asia/Yakutsk'
    | 'Asia/Yangon'
    | 'Asia/Yekaterinburg'
    | 'Asia/Yerevan'
    | 'Atlantic/Azores'
    | 'Atlantic/Bermuda'
    | 'Atlantic/Canary'
    | 'Atlantic/Cape_Verde'
    | 'Atlantic/Faeroe'
    | 'Atlantic/Faroe'
    | 'Atlantic/Jan_Mayen'
    | 'Atlantic/Madeira'
    | 'Atlantic/Reykjavik'
    | 'Atlantic/South_Georgia'
    | 'Atlantic/St_Helena'
    | 'Atlantic/Stanley'
    | 'Australia/ACT'
    | 'Australia/Adelaide'
    | 'Australia/Brisbane'
    | 'Australia/Broken_Hill'
    | 'Australia/Canberra'
    | 'Australia/Currie'
    | 'Australia/Darwin'
    | 'Australia/Eucla'
    | 'Australia/Hobart'
    | 'Australia/LHI'
    | 'Australia/Lindeman'
    | 'Australia/Lord_Howe'
    | 'Australia/Melbourne'
    | 'Australia/NSW'
    | 'Australia/North'
    | 'Australia/Perth'
    | 'Australia/Queensland'
    | 'Australia/South'
    | 'Australia/Sydney'
    | 'Australia/Tasmania'
    | 'Australia/Victoria'
    | 'Australia/West'
    | 'Australia/Yancowinna'
    | 'Brazil/Acre'
    | 'Brazil/DeNoronha'
    | 'Brazil/East'
    | 'Brazil/West'
    | 'CET'
    | 'CST6CDT'
    | 'Canada/Atlantic'
    | 'Canada/Central'
    | 'Canada/Eastern'
    | 'Canada/Mountain'
    | 'Canada/Newfoundland'
    | 'Canada/Pacific'
    | 'Canada/Saskatchewan'
    | 'Canada/Yukon'
    | 'Chile/Continental'
    | 'Chile/EasterIsland'
    | 'Cuba'
    | 'EET'
    | 'EST'
    | 'EST5EDT'
    | 'Egypt'
    | 'Eire'
    | 'Etc/GMT'
    | 'Etc/GMT+0'
    | 'Etc/GMT+1'
    | 'Etc/GMT+10'
    | 'Etc/GMT+11'
    | 'Etc/GMT+12'
    | 'Etc/GMT+2'
    | 'Etc/GMT+3'
    | 'Etc/GMT+4'
    | 'Etc/GMT+5'
    | 'Etc/GMT+6'
    | 'Etc/GMT+7'
    | 'Etc/GMT+8'
    | 'Etc/GMT+9'
    | 'Etc/GMT-0'
    | 'Etc/GMT-1'
    | 'Etc/GMT-10'
    | 'Etc/GMT-11'
    | 'Etc/GMT-12'
    | 'Etc/GMT-13'
    | 'Etc/GMT-14'
    | 'Etc/GMT-2'
    | 'Etc/GMT-3'
    | 'Etc/GMT-4'
    | 'Etc/GMT-5'
    | 'Etc/GMT-6'
    | 'Etc/GMT-7'
    | 'Etc/GMT-8'
    | 'Etc/GMT-9'
    | 'Etc/GMT0'
    | 'Etc/Greenwich'
    | 'Etc/UCT'
    | 'Etc/UTC'
    | 'Etc/Universal'
    | 'Etc/Zulu'
    | 'Europe/Amsterdam'
    | 'Europe/Andorra'
    | 'Europe/Astrakhan'
    | 'Europe/Athens'
    | 'Europe/Belfast'
    | 'Europe/Belgrade'
    | 'Europe/Berlin'
    | 'Europe/Bratislava'
    | 'Europe/Brussels'
    | 'Europe/Bucharest'
    | 'Europe/Budapest'
    | 'Europe/Busingen'
    | 'Europe/Chisinau'
    | 'Europe/Copenhagen'
    | 'Europe/Dublin'
    | 'Europe/Gibraltar'
    | 'Europe/Guernsey'
    | 'Europe/Helsinki'
    | 'Europe/Isle_of_Man'
    | 'Europe/Istanbul'
    | 'Europe/Jersey'
    | 'Europe/Kaliningrad'
    | 'Europe/Kiev'
    | 'Europe/Kirov'
    | 'Europe/Kyiv'
    | 'Europe/Lisbon'
    | 'Europe/Ljubljana'
    | 'Europe/London'
    | 'Europe/Luxembourg'
    | 'Europe/Madrid'
    | 'Europe/Malta'
    | 'Europe/Mariehamn'
    | 'Europe/Minsk'
    | 'Europe/Monaco'
    | 'Europe/Moscow'
    | 'Europe/Nicosia'
    | 'Europe/Oslo'
    | 'Europe/Paris'
    | 'Europe/Podgorica'
    | 'Europe/Prague'
    | 'Europe/Riga'
    | 'Europe/Rome'
    | 'Europe/Samara'
    | 'Europe/San_Marino'
    | 'Europe/Sarajevo'
    | 'Europe/Saratov'
    | 'Europe/Simferopol'
    | 'Europe/Skopje'
    | 'Europe/Sofia'
    | 'Europe/Stockholm'
    | 'Europe/Tallinn'
    | 'Europe/Tirane'
    | 'Europe/Tiraspol'
    | 'Europe/Ulyanovsk'
    | 'Europe/Uzhgorod'
    | 'Europe/Vaduz'
    | 'Europe/Vatican'
    | 'Europe/Vienna'
    | 'Europe/Vilnius'
    | 'Europe/Volgograd'
    | 'Europe/Warsaw'
    | 'Europe/Zagreb'
    | 'Europe/Zaporozhye'
    | 'Europe/Zurich'
    | 'GB'
    | 'GB-Eire'
    | 'GMT'
    | 'GMT+0'
    | 'GMT-0'
    | 'GMT0'
    | 'Greenwich'
    | 'HST'
    | 'Hongkong'
    | 'Iceland'
    | 'Indian/Antananarivo'
    | 'Indian/Chagos'
    | 'Indian/Christmas'
    | 'Indian/Cocos'
    | 'Indian/Comoro'
    | 'Indian/Kerguelen'
    | 'Indian/Mahe'
    | 'Indian/Maldives'
    | 'Indian/Mauritius'
    | 'Indian/Mayotte'
    | 'Indian/Reunion'
    | 'Iran'
    | 'Israel'
    | 'Jamaica'
    | 'Japan'
    | 'Kwajalein'
    | 'Libya'
    | 'MET'
    | 'MST'
    | 'MST7MDT'
    | 'Mexico/BajaNorte'
    | 'Mexico/BajaSur'
    | 'Mexico/General'
    | 'NZ'
    | 'NZ-CHAT'
    | 'Navajo'
    | 'PRC'
    | 'PST8PDT'
    | 'Pacific/Apia'
    | 'Pacific/Auckland'
    | 'Pacific/Bougainville'
    | 'Pacific/Chatham'
    | 'Pacific/Chuuk'
    | 'Pacific/Easter'
    | 'Pacific/Efate'
    | 'Pacific/Enderbury'
    | 'Pacific/Fakaofo'
    | 'Pacific/Fiji'
    | 'Pacific/Funafuti'
    | 'Pacific/Galapagos'
    | 'Pacific/Gambier'
    | 'Pacific/Guadalcanal'
    | 'Pacific/Guam'
    | 'Pacific/Honolulu'
    | 'Pacific/Johnston'
    | 'Pacific/Kanton'
    | 'Pacific/Kiritimati'
    | 'Pacific/Kosrae'
    | 'Pacific/Kwajalein'
    | 'Pacific/Majuro'
    | 'Pacific/Marquesas'
    | 'Pacific/Midway'
    | 'Pacific/Nauru'
    | 'Pacific/Niue'
    | 'Pacific/Norfolk'
    | 'Pacific/Noumea'
    | 'Pacific/Pago_Pago'
    | 'Pacific/Palau'
    | 'Pacific/Pitcairn'
    | 'Pacific/Pohnpei'
    | 'Pacific/Ponape'
    | 'Pacific/Port_Moresby'
    | 'Pacific/Rarotonga'
    | 'Pacific/Saipan'
    | 'Pacific/Samoa'
    | 'Pacific/Tahiti'
    | 'Pacific/Tarawa'
    | 'Pacific/Tongatapu'
    | 'Pacific/Truk'
    | 'Pacific/Wake'
    | 'Pacific/Wallis'
    | 'Pacific/Yap'
    | 'Poland'
    | 'Portugal'
    | 'ROC'
    | 'ROK'
    | 'Singapore'
    | 'Turkey'
    | 'UCT'
    | 'US/Alaska'
    | 'US/Aleutian'
    | 'US/Arizona'
    | 'US/Central'
    | 'US/East-Indiana'
    | 'US/Eastern'
    | 'US/Hawaii'
    | 'US/Indiana-Starke'
    | 'US/Michigan'
    | 'US/Mountain'
    | 'US/Pacific'
    | 'US/Samoa'
    | 'UTC'
    | 'Universal'
    | 'W-SU'
    | 'WET'
    | 'Zulu'
    | 'localtime'
    | '';
};

export type CreateExternalIssueRequest = {
  title: string;
  description?: string;
};

export type CreateGroupNote = {
  data: Record<string, unknown>;
  dateCreated: string;
  id: string;
  sentry_app: {
    avatars: Array<{
      avatarType: string;
      avatarUrl: string;
      avatarUuid: string;
      color: boolean;
      photoType: string;
    }>;
    id: string;
    name: string;
    slug: string;
  } | null;
  type: string;
  user: Record<string, unknown> | null;
};

export type CreateOrganizationReleaseResponse = {
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
};

export type CreateProjectReleaseResponse = {
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
};

export type CreateReplayDeletionJob = {
  data: {
    countDeleted: number;
    dateCreated: string;
    dateUpdated: string;
    environments: string[];
    id: number;
    query: string;
    rangeEnd: string;
    rangeStart: string;
    status: string;
  };
};

export type CrossEvent = {
  query: string;
  type: 'spans' | 'logs' | 'metrics';
  metric?: Metric | null;
};

export type CsrfTokenResponse = {
  detail: string;
  session: {
    sessionCsrfToken?: string | null;
    sessionExpiryDate?: string | null;
    sessionOrgs?: string[] | null;
    todo2faSetup?: boolean | null;
    todo2faVerification?: boolean | null;
    todoEmailVerification?: boolean | null;
    todoPasswordReset?: boolean | null;
    userId?: string | null;
  };
};

export type CustomInboundFilter = {
  conditions: CustomInboundFilterCondition[];
  dataType: 'all' | 'error' | 'log' | 'metric' | 'span';
  dateCreated: string;
  dateUpdated: string;
  id: string;
  active?: boolean;
  name?: string | null;
};

export type CustomInboundFilterCondition = {
  type: 'error_type' | 'error_message' | 'log_message' | 'metric_name' | 'release';
  value: string[];
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type Dashboard = {
  title: string;
  end?: string | null;
  environment?: string[] | null;
  filters?: Record<string, unknown>;
  id?: string;
  is_favorited?: boolean;
  period?: string | null;
  permissions?: DashboardPermissions | null;
  projects?: number[];
  start?: string | null;
  utc?: boolean;
  widgets?: DashboardCreateWidget[];
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type DashboardCreateWidget = {
  axis_range?: 'auto' | 'dataMin' | null;
  description?: string | null;
  display_type?:
    | 'line'
    | 'area'
    | 'bar'
    | 'table'
    | 'big_number'
    | 'details'
    | 'categorical_bar'
    | 'wheel'
    | 'rage_and_dead_clicks'
    | 'server_tree'
    | 'text'
    | 'agents_traces_table'
    | 'heatmap';
  id?: string;
  interval?: string;
  layout?: DashboardCreateWidgetLayout | null;
  legend_type?: 'default' | 'breakdown' | null;
  limit?: number | null;
  queries?: DashboardWidgetQuery[];
  thresholds?: Record<string, unknown> | null;
  title?: string;
  widget_type?:
    | 'discover'
    | 'issue'
    | 'metrics'
    | 'error-events'
    | 'transaction-like'
    | 'spans'
    | 'logs'
    | 'tracemetrics'
    | 'preprod-app-size'
    | null;
};

/**
 * Widget grid layout position and dimensions for dashboard creation.
 *
 * The dashboard uses a 6-column grid. Required keys: x, y, w, h.
 * Constraints: x (0-5), y (>= 0), w (1-6), h (>= 1), and x + w <= 6.
 */
export type DashboardCreateWidgetLayout = {
  h: number;
  w: number;
  x: number;
  y: number;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type DashboardDetails = {
  end?: string | null;
  environment?: string[] | null;
  filters?: Record<string, unknown>;
  id?: string;
  period?: string | null;
  permissions?: DashboardPermissions | null;
  projects?: number[];
  start?: string | null;
  title?: string;
  utc?: boolean;
  widgets?: DashboardWidget[];
};

export type DashboardDetailsModel = {
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  dateCreated: string;
  filters: {
    globalFilter?: Array<Record<string, unknown>>;
    release?: string[];
    releaseId?: string[];
  };
  id: string;
  isFavorited: boolean;
  permissions: {
    isEditableByEveryone: boolean;
    teamsWithEditAccess: number[];
  } | null;
  prebuiltId: number | null;
  projects: number[];
  title: string;
  widgets: Array<{
    axisRange: string | null;
    changedReason: Array<{
      equations: Array<Record<string, string | string[]>> | null;
      orderby: Array<Record<string, string>> | null;
      selected_columns: string[];
    }> | null;
    dashboardId: string;
    datasetSource: string | null;
    dateCreated: string;
    description: string | null;
    displayType: string;
    exploreUrls: string[] | null;
    id: string;
    interval: string;
    layout: Record<string, number> | null;
    legendType: 'default' | 'breakdown' | null;
    limit: number | null;
    queries: Array<{
      aggregates: string[];
      columns: string[];
      conditions: string;
      fieldAliases: string[];
      fields: string[];
      id: string;
      isHidden: boolean;
      linkedDashboards: Array<{
        dashboardId: number;
        field: string;
      }>;
      name: string;
      onDemand: Array<{
        dashboardWidgetQueryId: number;
        enabled: boolean;
        extractionState: string;
      }>;
      orderby: string;
      selectedAggregate: number | null;
      widgetId: string;
    }>;
    thresholds: {
      max_values: Record<string, number>;
      unit: string;
      preferredPolarity?: string;
    } | null;
    title: string;
    widgetType: string | null;
  }>;
  end?: string;
  environment?: string[];
  expired?: boolean;
  period?: string;
  start?: string;
  utc?: string;
};

export type DashboardListResponse = Array<{
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  };
  dateCreated: string;
  environment: string[];
  filters: {
    globalFilter?: Array<Record<string, unknown>>;
    release?: string[];
    releaseId?: string[];
  };
  id: string;
  isFavorited: boolean;
  lastVisited: string | null;
  permissions: {
    isEditableByEveryone: boolean;
    teamsWithEditAccess: number[];
  } | null;
  prebuiltId: number | null;
  projects: number[];
  title: string;
  widgetDisplay: string[];
  widgetPreview: Array<Record<string, string>>;
}>;

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type DashboardPermissions = {
  is_editable_by_everyone: boolean;
  teams_with_edit_access?: number[];
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type DashboardWidget = {
  axis_range?: 'auto' | 'dataMin' | null;
  description?: string | null;
  display_type?:
    | 'line'
    | 'area'
    | 'bar'
    | 'table'
    | 'big_number'
    | 'details'
    | 'categorical_bar'
    | 'wheel'
    | 'rage_and_dead_clicks'
    | 'server_tree'
    | 'text'
    | 'agents_traces_table'
    | 'heatmap';
  id?: string;
  interval?: string;
  layout?: WidgetLayout | null;
  legend_type?: 'default' | 'breakdown' | null;
  limit?: number | null;
  queries?: DashboardWidgetQuery[];
  thresholds?: Record<string, unknown> | null;
  title?: string;
  widget_type?:
    | 'discover'
    | 'issue'
    | 'metrics'
    | 'error-events'
    | 'transaction-like'
    | 'spans'
    | 'logs'
    | 'tracemetrics'
    | 'preprod-app-size'
    | null;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type DashboardWidgetQuery = {
  aggregates?: string[] | null;
  columns?: string[] | null;
  conditions?: string;
  field_aliases?: string[] | null;
  fields?: string[];
  id?: string;
  is_hidden?: boolean;
  linked_dashboards?: LinkedDashboard[] | null;
  name?: string;
  on_demand_extraction?: DashboardWidgetQueryOnDemand;
  on_demand_extraction_disabled?: boolean;
  orderby?: string;
  selected_aggregate?: number | null;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type DashboardWidgetQueryOnDemand = {
  enabled?: boolean;
  extraction_state?: string;
};

export type DataForwarder = {
  organization_id: number;
  provider: 'segment' | 'sqs' | 'splunk';
  config?: Record<string, string>;
  enroll_new_projects?: boolean;
  is_enabled?: boolean;
  project_ids?: number[];
};

export type DataForwarderResponse = {
  config: Record<string, string> | null;
  dateAdded: string;
  dateUpdated: string;
  enrollNewProjects: boolean;
  enrolledProjects: Array<{
    id: string;
    platform: string | null;
    slug: string;
  }>;
  id: string;
  isEnabled: boolean;
  organizationId: string;
  projectConfigs: Array<{
    dataForwarderId: string;
    dateAdded: string;
    dateUpdated: string;
    effectiveConfig: Record<string, string>;
    id: string;
    isEnabled: boolean;
    overrides: Record<string, string>;
    project: {
      id: string;
      platform: string | null;
      slug: string;
    };
  }>;
  provider: string;
};

export type Deploy = {
  environment: string;
  dateFinished?: string | null;
  dateStarted?: string | null;
  name?: string | null;
  projects?: string[];
  url?: string | null;
};

/** Serializer for Deploy response objects */
export type DeployResponse = {
  dateFinished: string;
  dateStarted: string | null;
  environment: string;
  id: string;
  name: string | null;
  url: string | null;
};

export type DetailedProject = {
  access: string[];
  allowedDomains: string[];
  autofixAutomationTuning: string;
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  builtinSymbolSources: string[];
  color: string;
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  dateCreated: string;
  debugFilesRole: string | null;
  defaultEnvironment: string | null;
  derivedGroupingEnhancements: string;
  digestsMaxDelay: number;
  digestsMinDelay: number;
  dynamicSamplingBiases: Array<Record<string, string | boolean>> | null;
  enableAutoReleaseCreation: boolean;
  features: string[];
  fingerprintingRules: string;
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  groupingConfig: string;
  groupingEnhancements: string;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  highlightContext: Record<string, unknown>;
  highlightPreset: {
    context: Record<string, string[]>;
    tags: string[];
  };
  highlightTags: string[];
  id: string;
  isBookmarked: boolean;
  isDynamicallySampled: boolean;
  isInternal: boolean;
  isMember: boolean;
  isPublic: boolean;
  latestRelease: {
    version: string;
  } | null;
  name: string;
  options: Record<string, unknown>;
  organization: {
    allowMemberInvite: boolean;
    allowMemberProjectCreation: boolean;
    allowSuperuserAccess: boolean;
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    dateCreated: string;
    hasAuthProvider: boolean;
    id: string;
    isEarlyAdopter: boolean;
    links: {
      organizationUrl: string;
      regionUrl: string;
    };
    name: string;
    require2FA: boolean;
    slug: string;
    status: {
      id: string;
      name: string;
    };
    access?: string[];
    extraOptions?: Record<string, Record<string, unknown>>;
    features?: string[];
    onboardingTasks?: Array<{
      completionSeen: string | null;
      data: unknown;
      dateCompleted: string;
      status: string;
      task: string | null;
    }>;
  };
  platform: string | null;
  platforms: string[];
  processingIssues: number;
  relayPiiConfig: string | null;
  resolveAge: number;
  safeFields: string[];
  scmSourceContextEnabled: boolean;
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  secondaryGroupingConfig: string | null;
  secondaryGroupingExpiry: number;
  securityToken: string;
  securityTokenHeader: string | null;
  seerNightshiftTweaks: unknown;
  seerScannerAutomation: boolean;
  sensitiveFields: string[];
  slug: string;
  status: string;
  storeCrashReports: number | null;
  subjectPrefix: string;
  subjectTemplate: string;
  symbolSources: string;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  tempestFetchScreenshots: boolean;
  verifySSL: boolean;
  sessionStats?: unknown;
  stats?: unknown;
  team?: {
    id: string;
    name: string;
    slug: string;
  };
  transactionStats?: unknown;
};

export type Detector = {
  conditionGroup: Record<string, unknown> | null;
  config: Record<string, unknown>;
  dataSources: Array<Record<string, unknown>> | null;
  dateCreated: string;
  dateUpdated: string;
  enabled: boolean;
  id: string;
  name: string;
  projectId: string | null;
  type: string;
  workflowIds: string[] | null;
  createdBy?: string | null;
  description?: string | null;
  latestGroup?: Record<string, unknown> | null;
  owner?: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  } | null;
};

export type DetectorCountResponse = {
  active: number;
  inactive: number;
  total: number;
};

export type DiscoverSavedQuery = {
  name: string;
  aggregations?: Array<unknown[]> | null;
  conditions?: Array<unknown[]> | null;
  display?: string | null;
  end?: string | null;
  environment?: string[] | null;
  fields?: string[] | null;
  groupby?: string[] | null;
  interval?: string | null;
  limit?: number | null;
  orderby?: string | null;
  projects?: number[];
  query?: string | null;
  queryDataset?: 'discover' | 'error-events' | 'transaction-like';
  range?: string | null;
  rollup?: number | null;
  start?: string | null;
  topEvents?: number | null;
  version?: number | null;
  widths?: string[] | null;
  yAxis?: string[] | null;
};

export type DiscoverSavedQueryListResponse = Array<{
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  };
  datasetSource: string;
  dateCreated: string;
  dateUpdated: string;
  expired: boolean;
  id: string;
  name: string;
  projects: number[];
  queryDataset: string;
  version: number;
  aggregations?: string[];
  conditions?: string[];
  display?: string;
  end?: string;
  environment?: string[];
  exploreQuery?: Record<string, unknown>;
  fields?: string[];
  interval?: string;
  lastVisited?: string;
  limit?: string;
  orderby?: string;
  position?: number | null;
  query?: string;
  range?: string;
  starred?: boolean;
  start?: string;
  topEvents?: number;
  widths?: string[];
  yAxis?: string[];
}>;

export type DiscoverSavedQueryModel = {
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  };
  datasetSource: string;
  dateCreated: string;
  dateUpdated: string;
  expired: boolean;
  id: string;
  name: string;
  projects: number[];
  queryDataset: string;
  version: number;
  aggregations?: string[];
  conditions?: string[];
  display?: string;
  end?: string;
  environment?: string[];
  exploreQuery?: Record<string, unknown>;
  fields?: string[];
  interval?: string;
  lastVisited?: string;
  limit?: string;
  orderby?: string;
  position?: number | null;
  query?: string;
  range?: string;
  starred?: boolean;
  start?: string;
  topEvents?: number;
  widths?: string[];
  yAxis?: string[];
};

export type DynamicSamplingBias = {
  id:
    | 'boostEnvironments'
    | 'boostKeyTransactions'
    | 'boostLatestRelease'
    | 'boostLowVolumeTransactions'
    | 'boostReplayId'
    | 'ignoreHealthChecks'
    | 'minimumSampleRate'
    | 'recalibrationRule';
  active?: boolean;
};

/**
 * Configures multiple options for the Javascript Loader Script.
 * - `Performance Monitoring`
 * - `Debug Bundles & Logging`
 * - `Session Replay` - Note that the loader will load the ES6 bundle instead of the ES5 bundle.
 * - `User Feedback` - Note that the loader will load the ES6 bundle instead of the ES5 bundle.
 * - `Logs and Metrics` - Note that the loader will load the ES6 bundle instead of the ES5 bundle. Requires SDK >= 10.0.0.
 * ```json
 * {
 *     "dynamicSdkLoaderOptions": {
 *         "hasReplay": true,
 *         "hasPerformance": true,
 *         "hasDebug": true,
 *         "hasFeedback": true,
 *         "hasLogsAndMetrics": true
 *     }
 * }
 * ```
 */
export type DynamicSdkLoaderOption = {
  hasDebug?: boolean;
  hasFeedback?: boolean;
  hasLogsAndMetrics?: boolean;
  hasPerformance?: boolean;
  hasReplay?: boolean;
};

export type Environment = {
  isHidden: boolean;
};

export type EnvironmentProject = {
  id: string;
  isHidden: boolean;
  name: string;
};

export type EventAttachmentDetailsResponse = {
  dateCreated: string;
  event_id: string;
  headers: Record<string, string | null>;
  id: string;
  mimetype: string | null;
  name: string;
  sha1: string | null;
  size: number;
  type: string;
};

export type EventIdLookupResponse = {
  event: {
    _meta: Record<string, unknown>;
    context: Record<string, unknown> | null;
    contexts: Record<string, unknown> | null;
    dateReceived: string | null;
    dist: string | null;
    entries: unknown[];
    errors: Array<{
      data: Record<string, unknown>;
      message: string;
      type: string;
    }>;
    eventID: string;
    groupID: string | null;
    id: string;
    location: string | null;
    message: string | null;
    metadata: Record<string, unknown>;
    occurrence: {
      assignee: string | null;
      culprit: string | null;
      detectionTime: number;
      eventId: string;
      evidenceData: Record<string, unknown>;
      evidenceDisplay: Array<{
        important: boolean;
        name: string;
        value: string;
      }>;
      fingerprint: string[];
      id: string;
      issueTitle: string;
      level: string | null;
      priority: number | null;
      projectId: number;
      resourceId: string | null;
      subtitle: string;
      type: number;
    } | null;
    packages: Record<string, unknown>;
    platform: string;
    projectID: string;
    sdk: {
      name: string | null;
      version: string | null;
    } | null;
    size: number | null;
    tags: Array<{
      key: string;
      value: string;
      query?: string;
    }>;
    title: string;
    type:
      | 'default'
      | 'error'
      | 'csp'
      | 'nel'
      | 'hpkp'
      | 'expectct'
      | 'expectstaple'
      | 'transaction'
      | 'generic'
      | 'feedback';
    user: {
      data?: Record<string, unknown> | null;
      email?: string | null;
      geo?: Record<string, string> | null;
      id?: string | null;
      ip_address?: string | null;
      name?: string | null;
      username?: string | null;
    } | null;
    breakdowns?: Record<
      string,
      Record<
        string,
        {
          unit: string | null;
          value: number;
        }
      >
    > | null;
    crashFile?: string | null;
    culprit?: string | null;
    dateCreated?: string;
    endTimestamp?: number;
    fingerprints?: string[];
    groupingConfig?: {
      enhancements: string;
      id: string;
    };
    measurements?: Record<
      string,
      {
        unit: string | null;
        value: number;
      }
    > | null;
    startTimestamp?: number;
  };
  eventId: string;
  groupId: string;
  organizationSlug: string;
  projectSlug: string;
};

export type ExploreSavedQuery = {
  name: string;
  query: Query[];
  agent?: string[] | null;
  crossEvents?: CrossEvent[] | null;
  dataset?:
    | 'spans'
    | 'logs'
    | 'segment_spans'
    | 'metrics'
    | 'replays'
    | 'ai_conversations';
  end?: string | null;
  environment?: string[] | null;
  interval?: string | null;
  projects?: number[];
  range?: string | null;
  start?: string | null;
};

export type ExploreSavedQueryListResponse = Array<{
  changedReason: {
    columns: string[];
    equations: Array<Record<string, string | string[]>> | null;
    orderby: Array<Record<string, string>> | null;
  } | null;
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  dataset:
    | 'spans'
    | 'logs'
    | 'segment_spans'
    | 'metrics'
    | 'replays'
    | 'ai_conversations';
  dateAdded: string;
  dateUpdated: string;
  expired: boolean;
  id: string;
  isPrebuilt: boolean;
  lastVisited: string | null;
  name: string;
  position: number | null;
  projects: number[];
  starred: boolean;
  agent?: string[];
  crossEvents?: Array<{
    query: string;
    type: 'spans' | 'logs' | 'metrics';
    metric?: {
      name: string;
      type: 'counter' | 'gauge' | 'distribution';
      unit?: string | null;
    } | null;
  }>;
  end?: string;
  environment?: string[];
  interval?: string;
  query?: Array<{
    mode: 'samples' | 'aggregate';
    aggregateField?: Array<{
      chartType?: number;
      groupBy?: string;
      yAxes?: string[];
    }> | null;
    aggregateOrderby?: string | null;
    caseInsensitive?: boolean;
    fields?: string[] | null;
    groupby?: string[] | null;
    metric?: {
      name: string;
      type: 'counter' | 'gauge' | 'distribution';
      unit?: string | null;
    } | null;
    orderby?: string | null;
    query?: string | null;
    visualize?: Array<{
      yAxes: string[];
      chartType?: number;
    }> | null;
  }>;
  range?: string;
  start?: string;
}>;

export type ExploreSavedQueryModel = {
  changedReason: {
    columns: string[];
    equations: Array<Record<string, string | string[]>> | null;
    orderby: Array<Record<string, string>> | null;
  } | null;
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  dataset:
    | 'spans'
    | 'logs'
    | 'segment_spans'
    | 'metrics'
    | 'replays'
    | 'ai_conversations';
  dateAdded: string;
  dateUpdated: string;
  expired: boolean;
  id: string;
  isPrebuilt: boolean;
  lastVisited: string | null;
  name: string;
  position: number | null;
  projects: number[];
  starred: boolean;
  agent?: string[];
  crossEvents?: Array<{
    query: string;
    type: 'spans' | 'logs' | 'metrics';
    metric?: {
      name: string;
      type: 'counter' | 'gauge' | 'distribution';
      unit?: string | null;
    } | null;
  }>;
  end?: string;
  environment?: string[];
  interval?: string;
  query?: Array<{
    mode: 'samples' | 'aggregate';
    aggregateField?: Array<{
      chartType?: number;
      groupBy?: string;
      yAxes?: string[];
    }> | null;
    aggregateOrderby?: string | null;
    caseInsensitive?: boolean;
    fields?: string[] | null;
    groupby?: string[] | null;
    metric?: {
      name: string;
      type: 'counter' | 'gauge' | 'distribution';
      unit?: string | null;
    } | null;
    orderby?: string | null;
    query?: string | null;
    visualize?: Array<{
      yAxes: string[];
      chartType?: number;
    }> | null;
  }>;
  range?: string;
  start?: string;
};

/** Serializer for the agent-based autofix requests. */
export type ExplorerAutofixRequest = {
  enable_bash_tools?: boolean;
  insert_index?: number;
  integration_id?: number;
  provider?: string;
  referrer?: string;
  repo_name?: string;
  run_id?: number;
  sentry_run_id?: string;
  step?:
    | 'root_cause'
    | 'solution'
    | 'code_changes'
    | 'pr_iteration'
    | 'open_pr'
    | 'coding_agent_handoff';
  stopping_point?: 'root_cause' | 'solution' | 'code_changes' | 'open_pr';
  user_context?: string;
};

export type ExternalActor = {
  externalName: string;
  id: string;
  integrationId: string;
  provider: string;
  externalId?: string;
  teamId?: string;
  userId?: string;
};

export type ExternalIssueLinkResponse = {
  displayName: string;
  id: number;
  integrationId: number;
  key: string;
  url: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type ExternalTeam = {
  external_name: string;
  integration_id: number;
  provider:
    | 'github'
    | 'github_enterprise'
    | 'jira_server'
    | 'slack'
    | 'slack_staging'
    | 'perforce'
    | 'gitlab'
    | 'msteams'
    | 'custom_scm';
  team_id: number;
  external_id?: string | null;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type ExternalUser = {
  external_name: string;
  id: number;
  integration_id: number;
  provider:
    | 'github'
    | 'github_enterprise'
    | 'jira_server'
    | 'slack'
    | 'slack_staging'
    | 'perforce'
    | 'gitlab'
    | 'msteams'
    | 'custom_scm';
  user_id: number;
  external_id?: string | null;
};

/**
 * Filter settings for the source. This is optional for all sources.
 *
 * **`filetypes`** ***(list)*** - A list of file types that can be found on this source. If this is left empty, all file types will be enabled. The options are:
 * - `pe` - Windows executable files
 * - `pdb` - Windows debug files
 * - `portablepdb` - .NET portable debug files
 * - `mach_code` - MacOS executable files
 * - `mach_debug` - MacOS debug files
 * - `elf_code` - ELF executable files
 * - `elf_debug` - ELF debug files
 * - `wasm_code` - WASM executable files
 * - `wasm_debug` - WASM debug files
 * - `breakpad` - Breakpad symbol files
 * - `sourcebundle` - Source code bundles
 * - `uuidmap` - Apple UUID mapping files
 * - `bcsymbolmap` - Apple bitcode symbol maps
 * - `il2cpp` - Unity IL2CPP mapping files
 * - `proguard` - ProGuard mapping files
 *
 * **`path_patterns`** ***(list)*** - A list of glob patterns to check against the debug and code file paths of debug files. Only files that match one of these patterns will be requested from the source. If this is left empty, no path-based filtering takes place.
 *
 * **`requires_checksum`** ***(boolean)*** - Whether this source requires a debug checksum to be sent with each request. Defaults to `false`.
 *
 * ```json
 * {
 *     "filters": {
 *         "filetypes": ["pe", "pdb", "portablepdb"],
 *         "path_patterns": ["*ffmpeg*"]
 *     }
 * }
 * ```
 */
export type Filters = {
  filetypes?: Array<
    | 'pe'
    | 'pdb'
    | 'portablepdb'
    | 'mach_debug'
    | 'mach_code'
    | 'elf_debug'
    | 'elf_code'
    | 'wasm_debug'
    | 'wasm_code'
    | 'breakpad'
    | 'sourcebundle'
    | 'uuidmap'
    | 'bcsymbolmap'
    | 'il2cpp'
    | 'proguard'
    | 'dartsymbolmap'
  >;
  path_patterns?: string[];
  requires_checksum?: boolean;
};

export type GetReplay = {
  data: {
    activity?: number | null;
    browser?: {
      name?: string | null;
      version?: string | null;
    };
    clicks?: Array<Record<string, unknown>>;
    count_dead_clicks?: number | null;
    count_errors?: number | null;
    count_infos?: number | null;
    count_rage_clicks?: number | null;
    count_segments?: number | null;
    count_urls?: number | null;
    count_warnings?: number | null;
    device?: {
      brand?: string | null;
      family?: string | null;
      model?: string | null;
      name?: string | null;
    };
    dist?: string | null;
    duration?: number | null;
    environment?: string | null;
    error_ids?: string[];
    finished_at?: string | null;
    has_viewed?: boolean;
    id?: string;
    is_archived?: boolean | null;
    os?: {
      name?: string | null;
      version?: string | null;
    };
    ota_updates?: {
      channel?: string | null;
      runtime_version?: string | null;
      update_id?: string | null;
    };
    platform?: string | null;
    project_id?: string;
    releases?: string[];
    replay_type?: string;
    sdk?: {
      name?: string | null;
      version?: string | null;
    };
    segment_names?: string[] | null;
    started_at?: string | null;
    tags?: Record<string, string[]> | unknown[];
    trace_ids?: string[];
    urls?: string[] | null;
    user?: {
      display_name?: string | null;
      email?: string | null;
      geo?: {
        city?: string | null;
        country_code?: string | null;
        region?: string | null;
        subdivision?: string | null;
      };
      id?: string | null;
      ip?: string | null;
      username?: string | null;
    };
  };
};

export type GetReplayDeletionJob = {
  data: {
    countDeleted: number;
    dateCreated: string;
    dateUpdated: string;
    environments: string[];
    id: number;
    query: string;
    rangeEnd: string;
    rangeStart: string;
    status: string;
  };
};

export type GetReplayRecordingSegment = {
  data: {
    dateAdded: string | null;
    projectId: string;
    replayId: string;
    segmentId: number;
  };
};

export type GetReplayVideo = string;

export type GetReplayViewedBy = {
  data: {
    viewed_by: Array<Record<string, unknown>>;
  };
};

export type GroupDetailsResponse = {
  activity: Array<Record<string, unknown>>;
  annotations: Array<{
    displayName: string;
    url: string;
  }>;
  assignedTo: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  } | null;
  culprit: string | null;
  hasSeen: boolean;
  id: string;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  issueCategory: string;
  issueType: string;
  level: 'sample' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
  logger: string | null;
  metadata: Record<string, unknown>;
  numComments: number;
  participants: Array<Record<string, unknown>>;
  permalink: string;
  platform: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  priorityLockedAt: string | null;
  project: {
    id: string;
    name: string;
    platform: string | null;
    slug: string;
  };
  seenBy: Array<Record<string, unknown>>;
  seerAutofixLastTriggered: string | null;
  seerExplorerAutofixLastTriggered: string | null;
  seerFixabilityScore: number | null;
  shareId: string | null;
  shortId: string;
  status:
    | 'resolved'
    | 'ignored'
    | 'pending_deletion'
    | 'pending_merge'
    | 'reprocessing'
    | 'unresolved';
  statusDetails: {
    actor?: {
      avatarUrl: string;
      dateJoined: string;
      email: string;
      emails: Array<{
        email: string;
        id: string;
        is_verified: boolean;
      }>;
      experiments: Record<string, unknown>;
      has2fa: boolean;
      hasPasswordAuth: boolean;
      id: string;
      isActive: boolean;
      isManaged: boolean;
      isStaff: boolean;
      isSuperuser: boolean;
      isSuspended: boolean;
      lastActive: string | null;
      lastLogin: string | null;
      name: string;
      username: string;
      authenticators?: unknown[];
      avatar?: {
        avatarType?: string;
        avatarUrl?: string | null;
        avatarUuid?: string | null;
      };
      canReset2fa?: boolean;
      identities?: Array<{
        dateSynced: string;
        dateVerified: string;
        id: string;
        name: string;
        organization: {
          name: string;
          slug: string;
        };
        provider: {
          id: string;
          name: string;
        };
      }>;
    };
    ignoreCount?: number;
    ignoreUntil?: string;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
    inCommit?: string;
    inNextRelease?: boolean;
    inRelease?: string;
    info?: {
      dateCreated: string;
      syncCount: number;
      totalEvents: number;
    } | null;
    pendingEvents?: number;
  };
  subscriptionDetails: {
    disabled?: boolean;
    reason?: string;
  } | null;
  substatus:
    | 'archived_until_escalating'
    | 'archived_until_condition_met'
    | 'archived_forever'
    | 'escalating'
    | 'ongoing'
    | 'regressed'
    | 'new'
    | null;
  title: string;
  type:
    | 'default'
    | 'error'
    | 'csp'
    | 'nel'
    | 'hpkp'
    | 'expectct'
    | 'expectstaple'
    | 'transaction'
    | 'generic'
    | 'feedback';
  userReportCount: number;
  count?: string;
  derivedData?: {
    blocker: string;
    hasOpenFixPr: boolean;
    hasRootCause: boolean;
    isAssigned: boolean;
    lastCompletedAutofixStep: string;
    lastProgressedAt: string | null;
    progress: string;
    status: string;
    viewCount: number;
  };
  firstRelease?: Record<string, unknown> | null;
  firstSeen?: string | null;
  forecast?: Record<string, unknown>;
  inbox?: {
    date_added: string;
    reason: number;
    reason_details: {
      count: number | null;
      until: string | null;
      user_count: number | null;
      user_window: number | null;
      window: number | null;
    } | null;
  } | null;
  integrationIssues?: Array<Record<string, unknown>>;
  isUnhandled?: boolean;
  lastRelease?: Record<string, unknown> | null;
  lastSeen?: string | null;
  latestEventHasAttachments?: boolean;
  owners?: Array<{
    date_added: string;
    owner: string;
    type: string;
  }> | null;
  sentryAppIssues?: Array<{
    displayName: string;
    id: string;
    issueId: string;
    serviceType: string;
    webUrl: string;
  }>;
  stats?: Record<string, Array<number[]>>;
  tags?: Array<Record<string, unknown>>;
  userCount?: number;
};

export type GroupEventsResponseDict = Array<{
  crashFile: string | null;
  culprit: string | null;
  dateCreated: string;
  'event.type': string;
  eventID: string;
  groupID: string | null;
  id: string;
  location: string | null;
  message: string;
  metadata: Record<string, unknown>;
  platform: string | null;
  projectID: string;
  tags: Array<{
    key: string;
    value: string;
    query?: string;
  }>;
  title: string;
  user: {
    data?: Record<string, unknown> | null;
    email?: string | null;
    geo?: Record<string, string> | null;
    id?: string | null;
    ip_address?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
}>;

export type GroupExternalIssueResponse = Array<{
  displayName: string;
  id: string;
  issueId: string;
  serviceType: string;
  webUrl: string;
}>;

export type GroupHashesResponse = Array<{
  id: string;
  latestEvent:
    | {
        _meta: Record<string, unknown>;
        context: Record<string, unknown> | null;
        contexts: Record<string, unknown> | null;
        dateReceived: string | null;
        dist: string | null;
        entries: unknown[];
        errors: Array<{
          data: Record<string, unknown>;
          message: string;
          type: string;
        }>;
        eventID: string;
        groupID: string | null;
        id: string;
        location: string | null;
        message: string | null;
        metadata: Record<string, unknown>;
        occurrence: {
          assignee: string | null;
          culprit: string | null;
          detectionTime: number;
          eventId: string;
          evidenceData: Record<string, unknown>;
          evidenceDisplay: Array<{
            important: boolean;
            name: string;
            value: string;
          }>;
          fingerprint: string[];
          id: string;
          issueTitle: string;
          level: string | null;
          priority: number | null;
          projectId: number;
          resourceId: string | null;
          subtitle: string;
          type: number;
        } | null;
        packages: Record<string, unknown>;
        platform: string;
        projectID: string;
        sdk: {
          name: string | null;
          version: string | null;
        } | null;
        size: number | null;
        tags: Array<{
          key: string;
          value: string;
          query?: string;
        }>;
        title: string;
        type:
          | 'default'
          | 'error'
          | 'csp'
          | 'nel'
          | 'hpkp'
          | 'expectct'
          | 'expectstaple'
          | 'transaction'
          | 'generic'
          | 'feedback';
        user: {
          data?: Record<string, unknown> | null;
          email?: string | null;
          geo?: Record<string, string> | null;
          id?: string | null;
          ip_address?: string | null;
          name?: string | null;
          username?: string | null;
        } | null;
        breakdowns?: Record<
          string,
          Record<
            string,
            {
              unit: string | null;
              value: number;
            }
          >
        > | null;
        crashFile?: string | null;
        culprit?: string | null;
        dateCreated?: string;
        endTimestamp?: number;
        fingerprints?: string[];
        groupingConfig?: {
          enhancements: string;
          id: string;
        };
        measurements?: Record<
          string,
          {
            unit: string | null;
            value: number;
          }
        > | null;
        startTimestamp?: number;
      }
    | {
        crashFile: string | null;
        culprit: string | null;
        dateCreated: string;
        'event.type': string;
        eventID: string;
        groupID: string | null;
        id: string;
        location: string | null;
        message: string;
        metadata: Record<string, unknown>;
        platform: string | null;
        projectID: string;
        tags: Array<{
          key: string;
          value: string;
          query?: string;
        }>;
        title: string;
        user: {
          data?: Record<string, unknown> | null;
          email?: string | null;
          geo?: Record<string, string> | null;
          id?: string | null;
          ip_address?: string | null;
          name?: string | null;
          username?: string | null;
        } | null;
      }
    | Record<string, unknown>
    | null;
  mergedBySeer: boolean;
  seerMatchDistance: number | null;
}>;

export type GroupOpenPeriod = {
  activities: Array<{
    dateCreated: string;
    eventId: string | null;
    id: string;
    type: string;
    value: string | null;
  }> | null;
  end: string | null;
  id: string;
  isOpen: boolean;
  start: string;
};

export type GroupSearchViewPostValidator = {
  environments: string[];
  name: string;
  projects: number[];
  query: string;
  timeFilters: GroupSearchViewTimeFilters;
  querySort?: 'date' | 'new' | 'trends' | 'freq' | 'user' | 'inbox' | 'recommended';
  starred?: boolean;
};

export type GroupSearchViewTimeFilters = {
  end?: string | null;
  period?: string | null;
  start?: string | null;
  utc?: boolean | null;
};

export type GroupUpdateResponse = {
  annotations: Array<{
    displayName: string;
    url: string;
  }>;
  assignedTo: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  } | null;
  culprit: string | null;
  hasSeen: boolean;
  id: string;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  issueCategory: string;
  issueType: string;
  level: 'sample' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
  logger: string | null;
  metadata: Record<string, unknown>;
  numComments: number;
  permalink: string;
  platform: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  priorityLockedAt: string | null;
  project: {
    id: string;
    name: string;
    platform: string | null;
    slug: string;
  };
  seerAutofixLastTriggered: string | null;
  seerExplorerAutofixLastTriggered: string | null;
  seerFixabilityScore: number | null;
  shareId: string | null;
  shortId: string;
  status:
    | 'resolved'
    | 'ignored'
    | 'pending_deletion'
    | 'pending_merge'
    | 'reprocessing'
    | 'unresolved';
  statusDetails: {
    actor?: {
      avatarUrl: string;
      dateJoined: string;
      email: string;
      emails: Array<{
        email: string;
        id: string;
        is_verified: boolean;
      }>;
      experiments: Record<string, unknown>;
      has2fa: boolean;
      hasPasswordAuth: boolean;
      id: string;
      isActive: boolean;
      isManaged: boolean;
      isStaff: boolean;
      isSuperuser: boolean;
      isSuspended: boolean;
      lastActive: string | null;
      lastLogin: string | null;
      name: string;
      username: string;
      authenticators?: unknown[];
      avatar?: {
        avatarType?: string;
        avatarUrl?: string | null;
        avatarUuid?: string | null;
      };
      canReset2fa?: boolean;
      identities?: Array<{
        dateSynced: string;
        dateVerified: string;
        id: string;
        name: string;
        organization: {
          name: string;
          slug: string;
        };
        provider: {
          id: string;
          name: string;
        };
      }>;
    };
    ignoreCount?: number;
    ignoreUntil?: string;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
    inCommit?: string;
    inNextRelease?: boolean;
    inRelease?: string;
    info?: {
      dateCreated: string;
      syncCount: number;
      totalEvents: number;
    } | null;
    pendingEvents?: number;
  };
  subscriptionDetails: {
    disabled?: boolean;
    reason?: string;
  } | null;
  substatus:
    | 'archived_until_escalating'
    | 'archived_until_condition_met'
    | 'archived_forever'
    | 'escalating'
    | 'ongoing'
    | 'regressed'
    | 'new'
    | null;
  title: string;
  type:
    | 'default'
    | 'error'
    | 'csp'
    | 'nel'
    | 'hpkp'
    | 'expectct'
    | 'expectstaple'
    | 'transaction'
    | 'generic'
    | 'feedback';
  count?: string;
  derivedData?: {
    blocker: string;
    hasOpenFixPr: boolean;
    hasRootCause: boolean;
    isAssigned: boolean;
    lastCompletedAutofixStep: string;
    lastProgressedAt: string | null;
    progress: string;
    status: string;
    viewCount: number;
  };
  firstSeen?: string | null;
  isUnhandled?: boolean;
  lastSeen?: string | null;
  userCount?: number;
};

export type GroupValidator = {
  assignedTo: string;
  discard: boolean;
  hasSeen: boolean;
  ignoreCount: number;
  ignoreDuration: number;
  ignoreUserCount: number;
  ignoreUserWindow: number;
  ignoreWindow: number;
  inbox: boolean;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  merge: boolean;
  priority: 'low' | 'medium' | 'high';
  snoozeDuration: number | null;
  status: 'resolved' | 'unresolved' | 'ignored' | 'resolvedInNextRelease' | 'muted';
  statusDetails: StatusDetailsValidator;
  substatus:
    | 'archived_until_escalating'
    | 'archived_until_condition_met'
    | 'archived_forever'
    | 'escalating'
    | 'ongoing'
    | 'regressed'
    | 'new'
    | null;
};

export type InCommitValidator = {
  commit: string;
  repository: string;
};

export type IncidentGroupOpenPeriod = {
  groupId: string;
  incidentId: string | null;
  incidentIdentifier: string | null;
  openPeriodId: string;
};

export type InstallInfoResponse = {
  appInfo: {
    appId: string | null;
    artifactType: string | null;
    buildNumber: number | null;
    dateAdded: string | null;
    dateBuilt: string | null;
    name: string | null;
    version: string | null;
  };
  buildConfiguration: string | null;
  buildId: string;
  codesigningType: string | null;
  downloadCount: number;
  gitInfo: {
    baseRef: string | null;
    baseRepoName: string | null;
    baseSha: string | null;
    headRef: string | null;
    headRepoName: string | null;
    headSha: string | null;
    prNumber: number | null;
    provider: string | null;
  } | null;
  installGroups: string[] | null;
  installUrl: string | null;
  installUrlExpiresAt: string | null;
  isCodeSignatureValid: boolean | null;
  isInstallable: boolean;
  platform: string | null;
  profileName: string | null;
  projectId: string;
  projectSlug: string;
  releaseNotes: string | null;
  state: string;
};

export type IntegrationIssueConfigResponse = {
  accountType: string | null;
  domainName: string | null;
  icon: string | null;
  id: string;
  name: string;
  outOfDate: boolean | null;
  provider: {
    aspects: Record<string, unknown>;
    canAdd: boolean;
    canDisable: boolean;
    features: string[];
    key: string;
    name: string;
    slug: string;
  };
  scopes: string[] | null;
  status: string;
  createIssueConfig?: Array<Record<string, unknown>>;
  linkIssueConfig?: Array<Record<string, unknown>>;
};

export type InvalidEventsQueryResponse = {
  dataset: Array<{
    error: string | null;
    name: string;
    valid: boolean;
  }>;
  environment: Array<{
    error: string | null;
    valid: boolean;
  }>;
  field: Array<{
    attrType: string | null;
    error: string | null;
    name: string;
    valid: boolean;
  }>;
  orderby: Array<{
    attrType: string | null;
    error: string | null;
    name: string;
    valid: boolean;
  }>;
  projects: Array<{
    error: string | null;
    valid: boolean;
  }>;
  query: {
    error: string | null;
    fields: Array<{
      attrType: string | null;
      error: string | null;
      name: string;
      valid: boolean;
    }>;
    valid: boolean;
  };
  valid: boolean;
};

export type InviteRequest = {
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  inviterName: string | null;
  name: string;
  orgRole: string;
  pending: boolean;
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
};

export type IssueEventDetailsResponse = {
  _meta: Record<string, unknown>;
  context: Record<string, unknown> | null;
  contexts: Record<string, unknown> | null;
  dateReceived: string | null;
  dist: string | null;
  entries: unknown[];
  errors: Array<{
    data: Record<string, unknown>;
    message: string;
    type: string;
  }>;
  eventID: string;
  groupID: string | null;
  id: string;
  location: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  nextEventID: string | null;
  occurrence: {
    assignee: string | null;
    culprit: string | null;
    detectionTime: number;
    eventId: string;
    evidenceData: Record<string, unknown>;
    evidenceDisplay: Array<{
      important: boolean;
      name: string;
      value: string;
    }>;
    fingerprint: string[];
    id: string;
    issueTitle: string;
    level: string | null;
    priority: number | null;
    projectId: number;
    resourceId: string | null;
    subtitle: string;
    type: number;
  } | null;
  packages: Record<string, unknown>;
  platform: string;
  previousEventID: string | null;
  projectID: string;
  release: {
    commitCount?: number;
    data?: Record<string, unknown>;
    dateCreated?: string;
    dateReleased?: string | null;
    deployCount?: number;
    id?: number;
    lastCommit?: Record<string, unknown> | null;
    lastDeploy?: {
      dateFinished: string;
      environment: string;
      id: string;
      name: string;
      dateStarted?: string | null;
      url?: string | null;
    } | null;
    ref?: string | null;
    status?: string;
    url?: string | null;
    userAgent?: string | null;
    version?: string | null;
    versionInfo?: {
      buildHash: string | null;
      package: string | null;
      version: Record<string, unknown>;
      description?: string;
    } | null;
  } | null;
  resolvedWith: string[];
  sdk: {
    name: string | null;
    version: string | null;
  } | null;
  sdkUpdates: Array<Record<string, unknown>>;
  size: number | null;
  tags: Array<{
    key: string;
    value: string;
    query?: string;
  }>;
  title: string;
  type:
    | 'default'
    | 'error'
    | 'csp'
    | 'nel'
    | 'hpkp'
    | 'expectct'
    | 'expectstaple'
    | 'transaction'
    | 'generic'
    | 'feedback';
  user: {
    data?: Record<string, unknown> | null;
    email?: string | null;
    geo?: Record<string, string> | null;
    id?: string | null;
    ip_address?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  userReport: {
    comments: string;
    dateCreated: string;
    email: string | null;
    event: {
      eventID: string;
      id: string;
    };
    eventID: string;
    id: string;
    name: string | null;
    user: {
      avatarUrl: string | null;
      email: string | null;
      id: string;
      ipAddress: string | null;
      name: string | null;
      username: string | null;
    } | null;
  } | null;
  breakdowns?: Record<
    string,
    Record<
      string,
      {
        unit: string | null;
        value: number;
      }
    >
  > | null;
  crashFile?: string | null;
  culprit?: string | null;
  dateCreated?: string;
  endTimestamp?: number;
  fingerprints?: string[];
  formatted?: {
    content: string;
    format: 'markdown' | 'xml' | 'json';
  };
  groupingConfig?: {
    enhancements: string;
    id: string;
  };
  measurements?: Record<
    string,
    {
      unit: string | null;
      value: number;
    }
  > | null;
  startTimestamp?: number;
};

export type LatestBaseSnapshotResponse = {
  app_id?: string | null;
  date_added?: string;
  diff_threshold?: number | null;
  head_artifact_id?: string;
  image_count?: number;
  images?: Array<{
    canvas_theme?: 'light' | 'dark' | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    image_url?: string;
    key?: string;
    width?: number;
  }>;
  project_id?: string;
  project_slug?: string;
  vcs_info?: {
    base_ref?: string | null;
    base_sha?: string | null;
    head_ref?: string | null;
    head_repo_name?: string | null;
    head_sha?: string | null;
    pr_number?: number | null;
  };
};

export type LatestInstallableBuildResponse = {
  currentArtifact: {
    appInfo: {
      appId: string | null;
      artifactType: string | null;
      buildNumber: number | null;
      dateAdded: string | null;
      dateBuilt: string | null;
      name: string | null;
      version: string | null;
    };
    buildConfiguration: string | null;
    buildId: string;
    codesigningType: string | null;
    downloadCount: number;
    gitInfo: {
      baseRef: string | null;
      baseRepoName: string | null;
      baseSha: string | null;
      headRef: string | null;
      headRepoName: string | null;
      headSha: string | null;
      prNumber: number | null;
      provider: string | null;
    } | null;
    installGroups: string[] | null;
    installUrl: string | null;
    installUrlExpiresAt: string | null;
    isCodeSignatureValid: boolean | null;
    isInstallable: boolean;
    platform: string | null;
    profileName: string | null;
    projectId: string;
    projectSlug: string;
    releaseNotes: string | null;
    state: string;
  } | null;
  latestArtifact: {
    appInfo: {
      appId: string | null;
      artifactType: string | null;
      buildNumber: number | null;
      dateAdded: string | null;
      dateBuilt: string | null;
      name: string | null;
      version: string | null;
    };
    buildConfiguration: string | null;
    buildId: string;
    codesigningType: string | null;
    downloadCount: number;
    gitInfo: {
      baseRef: string | null;
      baseRepoName: string | null;
      baseSha: string | null;
      headRef: string | null;
      headRepoName: string | null;
      headSha: string | null;
      prNumber: number | null;
      provider: string | null;
    } | null;
    installGroups: string[] | null;
    installUrl: string | null;
    installUrlExpiresAt: string | null;
    isCodeSignatureValid: boolean | null;
    isInstallable: boolean;
    platform: string | null;
    profileName: string | null;
    projectId: string;
    projectSlug: string;
    releaseNotes: string | null;
    state: string;
  } | null;
};

/**
 * Layout settings for the source. This is required for HTTP, GCS, and S3 sources.
 *
 * **`type`** ***(string)*** - The layout of the folder structure. The options are:
 * - `native` - Platform-Specific (SymStore / GDB / LLVM)
 * - `symstore` - Microsoft SymStore
 * - `symstore_index2` - Microsoft SymStore (with index2.txt)
 * - `ssqp` - Microsoft SSQP
 * - `unified` - Unified Symbol Server Layout
 * - `debuginfod` - debuginfod
 *
 * **`casing`** ***(string)*** - The layout of the folder structure. The options are:
 * - `default` - Default (mixed case)
 * - `uppercase` - Uppercase
 * - `lowercase` - Lowercase
 *
 * ```json
 * {
 *     "layout": {
 *         "type": "native"
 *         "casing": "default"
 *     }
 * }
 * ```
 */
export type Layout = {
  casing: 'lowercase' | 'uppercase' | 'default';
  type:
    | 'native'
    | 'symstore'
    | 'symstore_index2'
    | 'ssqp'
    | 'unified'
    | 'debuginfod'
    | 'slashsymbols';
};

export type LinkExternalIssueRequest = {
  externalIssue: string;
  comment?: string;
  repo?: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type LinkedDashboard = {
  dashboard_id: string;
  field: string;
};

export type ListAvailableActionResponse = Array<{
  configSchema: Record<string, unknown>;
  dataSchema: Record<string, unknown>;
  handlerGroup: string;
  type: string;
  integrations?: unknown[];
  sentryApp?: {
    id: string;
    installationId: string;
    installationUuid: string;
    name: string;
    status: number;
    settings?: Record<string, unknown>;
    title?: string;
  };
  services?: unknown[];
}>;

export type ListClientKeysResponse = Array<{
  browserSdk: {
    choices: Array<string[]>;
  };
  browserSdkVersion: string;
  dateCreated: string | null;
  dsn: {
    cdn: string;
    crons: string;
    csp: string;
    integration: string;
    minidump: string;
    nel: string;
    otlp_logs: string;
    otlp_traces: string;
    playstation: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
    hasFeedback: boolean;
    hasLogsAndMetrics: boolean;
    hasPerformance: boolean;
    hasReplay: boolean;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: number;
  public: string | null;
  rateLimit: {
    count: number;
    window: number;
  } | null;
  secret: string | null;
  useCase?: string;
}>;

export type ListDataConditionHandlerResponse = Array<{
  comparisonJsonSchema: Record<string, unknown>;
  handlerGroup: string;
  type: string;
  handlerSubgroup?: string;
}>;

export type ListDataForwarderResponse = Array<{
  config: Record<string, string> | null;
  dateAdded: string;
  dateUpdated: string;
  enrollNewProjects: boolean;
  enrolledProjects: Array<{
    id: string;
    platform: string | null;
    slug: string;
  }>;
  id: string;
  isEnabled: boolean;
  organizationId: string;
  projectConfigs: Array<{
    dataForwarderId: string;
    dateAdded: string;
    dateUpdated: string;
    effectiveConfig: Record<string, string>;
    id: string;
    isEnabled: boolean;
    overrides: Record<string, string>;
    project: {
      id: string;
      platform: string | null;
      slug: string;
    };
  }>;
  provider: string;
}>;

export type ListDetectorSerializerResponse = Array<{
  conditionGroup: Record<string, unknown> | null;
  config: Record<string, unknown>;
  dataSources: Array<Record<string, unknown>> | null;
  dateCreated: string;
  dateUpdated: string;
  enabled: boolean;
  id: string;
  name: string;
  projectId: string | null;
  type: string;
  workflowIds: string[] | null;
  createdBy?: string | null;
  description?: string | null;
  latestGroup?: Record<string, unknown> | null;
  owner?: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  } | null;
}>;

export type ListDetectorTypes = string[];

export type ListEventAttachmentsResponse = Array<{
  dateCreated: string;
  event_id: string;
  headers: Record<string, string | null>;
  id: string;
  mimetype: string | null;
  name: string;
  sha1: string | null;
  size: number;
  type: string;
}>;

export type ListGroupNotes = Array<{
  data: Record<string, unknown>;
  dateCreated: string;
  id: string;
  sentry_app: {
    avatars: Array<{
      avatarType: string;
      avatarUrl: string;
      avatarUuid: string;
      color: boolean;
      photoType: string;
    }>;
    id: string;
    name: string;
    slug: string;
  } | null;
  type: string;
  user: Record<string, unknown> | null;
}>;

export type ListInviteRequests = Array<{
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  inviterName: string | null;
  name: string;
  orgRole: string;
  pending: boolean;
  teamRoles: Array<{
    role: string | null;
    teamSlug: string;
  }>;
  teams: string[];
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
  role?: string;
  roleName?: string;
}>;

export type ListMemberOnTeamResponse = Array<{
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  inviterName: string | null;
  name: string;
  orgRole: string;
  pending: boolean;
  teamRole: string | null;
  teamSlug: string;
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  };
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
  role?: string;
  roleName?: string;
}>;

export type ListMetricAlertRuleResponse = Array<{
  aggregate: string;
  createdBy: Record<string, unknown>;
  dateCreated: string;
  dateModified: string;
  id: string;
  name: string;
  organizationId: string;
  query: string;
  timeWindow: number;
  triggers: Array<Record<string, unknown>>;
  comparisonDelta?: number | null;
  dataset?: string | null;
  environment?: string | null;
  errors?: string[] | null;
  eventTypes?: string[] | null;
  extrapolationMode?: string | null;
  originalAlertRuleId?: string | null;
  owner?: string | null;
  projects?: string[] | null;
  queryType?: number | null;
  resolveThreshold?: number | null;
  snooze?: boolean | null;
  thresholdType?: number | null;
}>;

export type ListOrgMembersResponse = Array<{
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  inviterName: string | null;
  name: string;
  orgRole: string;
  pending: boolean;
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
}>;

export type ListOrgTeamResponse = Array<{
  access: string[];
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string | null;
  flags: Record<string, unknown>;
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
  teamRole: string | null;
  externalTeams?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
  organization?: {
    allowMemberInvite: boolean;
    allowMemberProjectCreation: boolean;
    allowSuperuserAccess: boolean;
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    dateCreated: string;
    hasAuthProvider: boolean;
    id: string;
    isEarlyAdopter: boolean;
    links: {
      organizationUrl: string;
      regionUrl: string;
    };
    name: string;
    require2FA: boolean;
    slug: string;
    status: {
      id: string;
      name: string;
    };
    access?: string[];
    extraOptions?: Record<string, Record<string, unknown>>;
    features?: string[];
    onboardingTasks?: Array<{
      completionSeen: string | null;
      data: unknown;
      dateCompleted: string;
      status: string;
      task: string | null;
    }>;
  };
  projects?: Array<{
    access: string[];
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    color: string;
    dateCreated: string;
    features: string[];
    firstEvent: string | null;
    firstTransactionEvent: boolean;
    hasAccess: boolean;
    hasFeedbacks: boolean;
    hasFlags: boolean;
    hasInsightsAgentMonitoring: boolean;
    hasInsightsAppStart: boolean;
    hasInsightsAssets: boolean;
    hasInsightsCaches: boolean;
    hasInsightsDb: boolean;
    hasInsightsHttp: boolean;
    hasInsightsMCP: boolean;
    hasInsightsQueues: boolean;
    hasInsightsScreenLoad: boolean;
    hasInsightsVitals: boolean;
    hasLogs: boolean;
    hasMinifiedStackTrace: boolean;
    hasMonitors: boolean;
    hasNewFeedbacks: boolean;
    hasProfiles: boolean;
    hasReplays: boolean;
    hasSessions: boolean;
    hasTraceMetrics: boolean;
    id: string;
    isBookmarked: boolean;
    isInternal: boolean;
    isMember: boolean;
    isPublic: boolean;
    name: string;
    platform: string | null;
    slug: string;
    status: string;
    sessionStats?: unknown;
    stats?: unknown;
    transactionStats?: unknown;
  }>;
}>;

export type ListOrganizationAIConversationsResponse = Array<{
  conversationId: string;
  endTimestamp: number;
  errors: number;
  firstInput: string | null;
  flow: string[];
  generationDuration: number;
  inputTokens: number;
  lastOutput: string | null;
  llmCalls: number;
  outputTokens: number;
  projectId: number | null;
  projects: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  startTimestamp: number;
  title: string | null;
  toolCalls: number;
  toolErrors: number;
  toolNames: string[];
  totalCost: number;
  totalTokens: number;
  traceCount: number;
  traceIds: string[];
  user: {
    email: string | null;
    id: string | null;
    ip_address: string | null;
    username: string | null;
  } | null;
  webUrl: string;
}>;

export type ListOrganizationClientKeysResponse = Array<{
  browserSdk: {
    choices: Array<string[]>;
  };
  browserSdkVersion: string;
  dateCreated: string | null;
  dsn: {
    cdn: string;
    crons: string;
    csp: string;
    integration: string;
    minidump: string;
    nel: string;
    otlp_logs: string;
    otlp_traces: string;
    playstation: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
    hasFeedback: boolean;
    hasLogsAndMetrics: boolean;
    hasPerformance: boolean;
    hasReplay: boolean;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: number;
  public: string | null;
  rateLimit: {
    count: number;
    window: number;
  } | null;
  secret: string | null;
  useCase?: string;
}>;

export type ListOrganizationIntegrationResponse = Array<{
  accountType: string | null;
  configData: unknown;
  configOrganization: unknown;
  domainName: string | null;
  externalId: string;
  gracePeriodEnd: string | null;
  icon: string | null;
  id: string;
  name: string;
  organizationId: number;
  organizationIntegrationStatus: string;
  outOfDate: boolean | null;
  provider: unknown;
  scopes: string[] | null;
  status: string;
}>;

export type ListOrganizationMemberResponse = Array<{
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  inviterName: string | null;
  name: string;
  orgRole: string;
  pending: boolean;
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
}>;

export type ListOrganizationReleaseCommitsResponse = Array<{
  dateCreated: string;
  id: string;
  message: string | null;
  pullRequest: {
    author:
      | {
          avatarUrl: string;
          dateJoined: string;
          email: string;
          emails: Array<{
            email: string;
            id: string;
            is_verified: boolean;
          }>;
          experiments: Record<string, unknown>;
          has2fa: boolean;
          hasPasswordAuth: boolean;
          id: string;
          isActive: boolean;
          isManaged: boolean;
          isStaff: boolean;
          isSuperuser: boolean;
          isSuspended: boolean;
          lastActive: string | null;
          lastLogin: string | null;
          name: string;
          username: string;
          authenticators?: unknown[];
          avatar?: {
            avatarType?: string;
            avatarUrl?: string | null;
            avatarUuid?: string | null;
          };
          canReset2fa?: boolean;
          identities?: Array<{
            dateSynced: string;
            dateVerified: string;
            id: string;
            name: string;
            organization: {
              name: string;
              slug: string;
            };
            provider: {
              id: string;
              name: string;
            };
          }>;
        }
      | {
          email: string;
          name: string | null;
        };
    dateCreated: string;
    externalUrl: string;
    id: string;
    mergedAt: string | null;
    message: string | null;
    repository: {
      dateCreated: string;
      id: string;
      name: string;
      externalId?: string | null;
      externalSlug?: string | null;
      integrationId?: string | null;
      provider?: Record<string, string>;
      settings?: {
        codeReviewTriggers: string[];
        enabledCodeReview: boolean;
      } | null;
      status?: string;
      url?: string | null;
    };
    status: 'merged' | 'open' | 'closed' | 'draft' | 'unknown' | null;
    title: string | null;
  } | null;
  releases: Array<{
    dateCreated: string;
    dateReleased: string | null;
    ref: string | null;
    shortVersion: string;
    url: string | null;
    version: string;
  }>;
  suspectCommitType: string;
  author?:
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
    | Record<string, never>;
  repository?: {
    dateCreated: string;
    id: string;
    name: string;
    externalId?: string | null;
    externalSlug?: string | null;
    integrationId?: string | null;
    provider?: Record<string, string>;
    settings?: {
      codeReviewTriggers: string[];
      enabledCodeReview: boolean;
    } | null;
    status?: string;
    url?: string | null;
  };
}>;

export type ListOrganizationReleasesResponse = Array<{
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
}>;

export type ListOrganizationRepositoriesResponse = Array<{
  dateCreated: string;
  id: string;
  name: string;
  externalId?: string | null;
  externalSlug?: string | null;
  integrationId?: string | null;
  provider?: Record<string, string>;
  settings?: {
    codeReviewTriggers: string[];
    enabledCodeReview: boolean;
  } | null;
  status?: string;
  url?: string | null;
}>;

export type ListOrganizationTagValuesResponse = Array<{
  count: number | null;
  firstSeen: string | null;
  key: string;
  lastSeen: string | null;
  name: string;
  value: string | null;
  query?: string | null;
}>;

export type ListOrganizationTagsResponse = Array<{
  key: string;
  name: string;
  topValues?: Array<{
    count: number | null;
    firstSeen: string | null;
    key: string;
    lastSeen: string | null;
    name: string;
    value: string | null;
    query?: string | null;
  }> | null;
  totalValues?: number | null;
  uniqueValues?: number | null;
}>;

export type ListOrganizationTraceMetricsResponse = Array<{
  count: number;
  lastSeen: number | null;
  name: string;
  type: 'counter' | 'gauge' | 'distribution';
  unit: string | null;
  context?: {
    brief?: string;
    details?: string[];
  };
}>;

export type ListOrganizations = Array<{
  allowMemberInvite: boolean;
  allowMemberProjectCreation: boolean;
  allowSuperuserAccess: boolean;
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string;
  hasAuthProvider: boolean;
  id: string;
  isEarlyAdopter: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    id: string;
    name: string;
  };
  access?: string[];
  extraOptions?: Record<string, Record<string, unknown>>;
  features?: string[];
  onboardingTasks?: Array<{
    completionSeen: string | null;
    data: unknown;
    dateCompleted: string;
    status: string;
    task: string | null;
  }>;
}>;

export type ListProjectDebugFilesResponse = Array<{
  codeId: string | null;
  cpuName: string;
  data: Record<string, unknown>;
  dateCreated: string;
  debugId: string;
  headers: Record<string, string>;
  id: string;
  objectName: string;
  sha1: string;
  size: number;
  symbolType: string;
  uuid: string;
}>;

export type ListProjectEnvironments = Array<{
  id: string;
  isHidden: boolean;
  name: string;
}>;

export type ListProjectReleaseCommitsResponse = Array<{
  dateCreated: string;
  id: string;
  message: string | null;
  pullRequest: {
    author:
      | {
          avatarUrl: string;
          dateJoined: string;
          email: string;
          emails: Array<{
            email: string;
            id: string;
            is_verified: boolean;
          }>;
          experiments: Record<string, unknown>;
          has2fa: boolean;
          hasPasswordAuth: boolean;
          id: string;
          isActive: boolean;
          isManaged: boolean;
          isStaff: boolean;
          isSuperuser: boolean;
          isSuspended: boolean;
          lastActive: string | null;
          lastLogin: string | null;
          name: string;
          username: string;
          authenticators?: unknown[];
          avatar?: {
            avatarType?: string;
            avatarUrl?: string | null;
            avatarUuid?: string | null;
          };
          canReset2fa?: boolean;
          identities?: Array<{
            dateSynced: string;
            dateVerified: string;
            id: string;
            name: string;
            organization: {
              name: string;
              slug: string;
            };
            provider: {
              id: string;
              name: string;
            };
          }>;
        }
      | {
          email: string;
          name: string | null;
        };
    dateCreated: string;
    externalUrl: string;
    id: string;
    mergedAt: string | null;
    message: string | null;
    repository: {
      dateCreated: string;
      id: string;
      name: string;
      externalId?: string | null;
      externalSlug?: string | null;
      integrationId?: string | null;
      provider?: Record<string, string>;
      settings?: {
        codeReviewTriggers: string[];
        enabledCodeReview: boolean;
      } | null;
      status?: string;
      url?: string | null;
    };
    status: 'merged' | 'open' | 'closed' | 'draft' | 'unknown' | null;
    title: string | null;
  } | null;
  releases: Array<{
    dateCreated: string;
    dateReleased: string | null;
    ref: string | null;
    shortVersion: string;
    url: string | null;
    version: string;
  }>;
  suspectCommitType: string;
  author?:
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
    | Record<string, never>;
  repository?: {
    dateCreated: string;
    id: string;
    name: string;
    externalId?: string | null;
    externalSlug?: string | null;
    integrationId?: string | null;
    provider?: Record<string, string>;
    settings?: {
      codeReviewTriggers: string[];
      enabledCodeReview: boolean;
    } | null;
    status?: string;
    url?: string | null;
  };
}>;

export type ListProjectReleaseRepositoriesResponse = Array<{
  dateCreated: string;
  id: string;
  name: string;
  externalId?: string | null;
  externalSlug?: string | null;
  integrationId?: string | null;
  provider?: Record<string, string>;
  settings?: {
    codeReviewTriggers: string[];
    enabledCodeReview: boolean;
  } | null;
  status?: string;
  url?: string | null;
}>;

export type ListProjectReleasesResponse = Array<{
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
}>;

export type ListProjectTagKeys = Array<{
  canDelete: boolean;
  key: string;
  name: string;
  uniqueValues?: number;
}>;

export type ListProjectUsersResponse = Array<{
  avatarUrl: string;
  dateCreated: string | null;
  email: string;
  hash: string;
  id: string | null;
  identifier: string;
  ipAddress: string;
  name: string;
  tagValue: string;
  username: string;
}>;

export type ListReleaseFiles = Array<{
  dateCreated: string;
  dist: string | null;
  headers: Record<string, unknown>;
  id: string;
  name: string;
  sha1: string;
  size: number;
}>;

export type ListReleaseSetupSteps = Array<{
  complete: boolean;
  step: string;
}>;

export type ListReplayClicks = {
  data: Array<{
    node_id: number;
    timestamp: string;
  }>;
};

export type ListReplayDeletionJobs = {
  data: Array<{
    countDeleted: number;
    dateCreated: string;
    dateUpdated: string;
    environments: string[];
    id: number;
    query: string;
    rangeEnd: string;
    rangeStart: string;
    status: string;
  }>;
};

export type ListReplayRecordingSegments = Array<Array<Record<string, unknown>>>;

export type ListReplays = {
  data: Array<{
    activity?: number | null;
    browser?: {
      name?: string | null;
      version?: string | null;
    };
    clicks?: Array<Record<string, unknown>>;
    count_dead_clicks?: number | null;
    count_errors?: number | null;
    count_infos?: number | null;
    count_rage_clicks?: number | null;
    count_segments?: number | null;
    count_urls?: number | null;
    count_warnings?: number | null;
    device?: {
      brand?: string | null;
      family?: string | null;
      model?: string | null;
      name?: string | null;
    };
    dist?: string | null;
    duration?: number | null;
    environment?: string | null;
    error_ids?: string[];
    finished_at?: string | null;
    has_viewed?: boolean;
    id?: string;
    is_archived?: boolean | null;
    os?: {
      name?: string | null;
      version?: string | null;
    };
    ota_updates?: {
      channel?: string | null;
      runtime_version?: string | null;
      update_id?: string | null;
    };
    platform?: string | null;
    project_id?: string;
    releases?: string[];
    replay_type?: string;
    sdk?: {
      name?: string | null;
      version?: string | null;
    };
    segment_names?: string[] | null;
    started_at?: string | null;
    tags?: Record<string, string[]> | unknown[];
    trace_ids?: string[];
    urls?: string[] | null;
    user?: {
      display_name?: string | null;
      email?: string | null;
      geo?: {
        city?: string | null;
        country_code?: string | null;
        region?: string | null;
        subdivision?: string | null;
      };
      id?: string | null;
      ip?: string | null;
      username?: string | null;
    };
  }>;
};

export type ListRules = Array<{
  actionMatch: string | null;
  actions: Array<Record<string, unknown>>;
  conditions: Array<Record<string, unknown>>;
  dateCreated: string;
  filterMatch: string | null;
  filters: Array<Record<string, unknown>>;
  frequency: number;
  id: string | null;
  name: string;
  projects: string[];
  snooze: boolean;
  status: 'active' | 'disabled';
  createdBy?: {
    email: string;
    id: number;
    name: string;
  } | null;
  disableDate?: string;
  disableReason?: string;
  environment?: string | null;
  errors?: Array<{
    detail: string;
  }>;
  lastTriggered?: string | null;
  owner?: string | null;
  snoozeCreatedBy?: string | null;
  snoozeForEveryone?: boolean | null;
}>;

export type ListSelectors = {
  data: Array<{
    count_dead_clicks?: number;
    count_rage_clicks?: number;
    dom_element?: string;
    element?: {
      alt: string;
      aria_label: string;
      class: string[];
      component_name: string;
      id: string;
      role: string;
      tag: string;
      testid: string;
      title: string;
    };
    project_id?: string;
  }>;
};

export type ListSentryAppFeatures = Array<{
  featureGate: string;
  featureId: number;
  description?: string | null;
}>;

export type ListSentryAppInstallations = Array<{
  app: {
    sentryAppId: number;
    slug: string;
    uuid: string;
  };
  code: string;
  organization: {
    id: number;
    slug: string;
  };
  status: string;
  uuid: string;
}>;

export type ListServerlessFunctions = Array<{
  enabled: boolean;
  name: string;
  outOfDate: boolean;
  runtime: string;
  version: number;
}>;

export type ListServiceHookStats = Array<{
  total: number;
  ts: number;
}>;

export type ListServiceHooks = Array<{
  dateCreated: string;
  events: string[];
  id: string;
  secret: string;
  status: string;
  url: string;
}>;

export type ListTagValuesResponse = Array<{
  count: number | null;
  firstSeen: string | null;
  key: string;
  lastSeen: string | null;
  name: string;
  value: string | null;
  query?: string | null;
}>;

export type ListTeamProjectResponse = Array<{
  access: string[];
  dateCreated: string;
  environments: string[];
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  hasUserReports: boolean;
  id: string;
  isBookmarked: boolean;
  isMember: boolean;
  latestRelease: {
    version: string;
  } | null;
  name: string;
  platform: string | null;
  platforms: string[];
  slug: string;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  latestDeploys?: Record<string, Record<string, string>> | null;
  options?: Record<string, unknown>;
  sessionStats?: unknown;
  stats?: unknown;
  transactionStats?: unknown;
}>;

export type ListTraceItemAttributeValuesResponse = Array<{
  count: number | null;
  firstSeen: string | null;
  key: string;
  lastSeen: string | null;
  name: string;
  value: string | null;
  query?: string | null;
}>;

export type ListTraceItemAttributesResponse = Array<{
  attributeSource: {
    source_type: 'sentry' | 'user';
    is_transformed_alias?: boolean;
  };
  attributeType: 'string' | 'number' | 'boolean' | 'array';
  key: string;
  name: string;
  secondaryAliases?: string[];
}>;

export type ListTracesResponse = {
  data: Array<{
    breakdowns: Array<{
      duration: number;
      end: number;
      isRoot: boolean;
      kind: 'project' | 'missing' | 'other';
      project: string | null;
      sdkName: string | null;
      sliceEnd: number;
      sliceStart: number;
      sliceWidth: number;
      start: number;
      components?: Array<number[]>;
    }>;
    duration: number;
    end: number;
    matchingSpans: number;
    name: string | null;
    numErrors: number;
    numOccurrences: number;
    numSpans: number;
    project: string | null;
    rootDuration: number | null;
    start: number;
    trace: string;
  }>;
  meta: {
    bytesScanned?: number;
    dataScanned?: string;
    dataset?: string;
    datasetReason?: string;
    debug_info?: unknown;
    discoverSplitDecision?: unknown;
    fields?: Record<string, string>;
    isMetricsData?: boolean;
    isMetricsExtractedData?: boolean;
    tips?: Record<string, string>;
    units?: Record<string, string | null>;
  };
};

export type ListUserOrganizations = Array<{
  allowMemberInvite: boolean;
  allowMemberProjectCreation: boolean;
  allowSuperuserAccess: boolean;
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string;
  hasAuthProvider: boolean;
  id: string;
  isEarlyAdopter: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    id: string;
    name: string;
  };
  access?: string[];
  extraOptions?: Record<string, Record<string, unknown>>;
  features?: string[];
  onboardingTasks?: Array<{
    completionSeen: string | null;
    data: unknown;
    dateCompleted: string;
    status: string;
    task: string | null;
  }>;
}>;

export type ListWorkflow = Array<{
  actionFilters: Array<{
    actions?:
      | Array<{
          config?: Record<string, unknown>;
          data?: Record<string, string>;
          id?: string;
          integrationId?: string | null;
          status?: string;
          type?: string;
        }>
      | unknown[];
    conditions?:
      | Array<{
          comparison: boolean | number;
          conditionResult: boolean;
          id: string;
          type: string;
        }>
      | unknown[];
    id?: string;
    logicType?: string;
    organizationId?: string;
  }> | null;
  config: Record<string, unknown>;
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  detectorIds: string[] | null;
  enabled: boolean;
  environment: string | null;
  id: string;
  lastTriggered: string | null;
  name: string;
  organizationId: string;
  owner: string | null;
  triggers: {
    actions?:
      | Array<{
          config?: Record<string, unknown>;
          data?: Record<string, string>;
          id?: string;
          integrationId?: string | null;
          status?: string;
          type?: string;
        }>
      | unknown[];
    conditions?:
      | Array<{
          comparison: boolean | number;
          conditionResult: boolean;
          id: string;
          type: string;
        }>
      | unknown[];
    id?: string;
    logicType?: string;
    organizationId?: string;
  } | null;
}>;

export type Metric = {
  name: string;
  type: 'counter' | 'gauge' | 'distribution';
  unit?: string | null;
};

export type MetricAlertRuleAsyncResponse = {
  uuid: string;
};

/** This represents a Sentry Metric Alert Rule. */
export type MetricAlertRuleResponse = {
  aggregate: string;
  createdBy: Record<string, unknown>;
  dateCreated: string;
  dateModified: string;
  id: string;
  name: string;
  organizationId: string;
  query: string;
  timeWindow: number;
  triggers: Array<Record<string, unknown>>;
  comparisonDelta?: number | null;
  dataset?: string | null;
  environment?: string | null;
  errors?: string[] | null;
  eventTypes?: string[] | null;
  extrapolationMode?: string | null;
  originalAlertRuleId?: string | null;
  owner?: string | null;
  projects?: string[] | null;
  queryType?: number | null;
  resolveThreshold?: number | null;
  snooze?: boolean | null;
  thresholdType?: number | null;
};

export type Monitor = {
  config: {
    alert_rule_id: number | null;
    checkin_margin: number | null;
    failure_issue_threshold: number | null;
    max_runtime: number | null;
    recovery_threshold: number | null;
    schedule: string | number[];
    schedule_type: 'crontab' | 'interval';
    timezone: string | null;
  };
  dateCreated: string;
  environments: {
    activeIncident: {
      brokenNotice: {
        environmentMutedTimestamp: string;
        userNotifiedTimestamp: string;
      } | null;
      resolvingTimestamp: string;
      startingTimestamp: string;
    } | null;
    dateCreated: string;
    isMuted: boolean;
    lastCheckIn: string;
    name: string;
    nextCheckIn: string;
    nextCheckInLatest: string;
    status: string;
  };
  id: string;
  isMuted: boolean;
  isUpserting: boolean;
  name: string;
  owner: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  };
  project: {
    access: string[];
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    color: string;
    dateCreated: string;
    features: string[];
    firstEvent: string | null;
    firstTransactionEvent: boolean;
    hasAccess: boolean;
    hasFeedbacks: boolean;
    hasFlags: boolean;
    hasInsightsAgentMonitoring: boolean;
    hasInsightsAppStart: boolean;
    hasInsightsAssets: boolean;
    hasInsightsCaches: boolean;
    hasInsightsDb: boolean;
    hasInsightsHttp: boolean;
    hasInsightsMCP: boolean;
    hasInsightsQueues: boolean;
    hasInsightsScreenLoad: boolean;
    hasInsightsVitals: boolean;
    hasLogs: boolean;
    hasMinifiedStackTrace: boolean;
    hasMonitors: boolean;
    hasNewFeedbacks: boolean;
    hasProfiles: boolean;
    hasReplays: boolean;
    hasSessions: boolean;
    hasTraceMetrics: boolean;
    id: string;
    isBookmarked: boolean;
    isInternal: boolean;
    isMember: boolean;
    isPublic: boolean;
    name: string;
    platform: string | null;
    slug: string;
    status: string;
    sessionStats?: unknown;
    stats?: unknown;
    transactionStats?: unknown;
  };
  slug: string;
  status: string;
  alertRule?: {
    environment: string;
    targets: Array<{
      targetIdentifier: number;
      targetType: string;
    }>;
  };
};

export type MonitorAlertRuleTargetValidator = {
  target_identifier: number;
  target_type: string;
};

export type MonitorAlertRuleValidator = {
  targets: MonitorAlertRuleTargetValidator[];
  environment?: string | null;
};

export type MonitorBulkEditResponse = unknown;

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type MonitorBulkEditValidator = {
  config: ConfigValidator;
  ids: string[];
  name: string;
  project: string;
  alert_rule?: MonitorAlertRuleValidator;
  is_muted?: boolean;
  owner?: string | null;
  slug?: string;
  status?: 'active' | 'disabled';
};

export type MonitorList = Array<{
  config: {
    alert_rule_id: number | null;
    checkin_margin: number | null;
    failure_issue_threshold: number | null;
    max_runtime: number | null;
    recovery_threshold: number | null;
    schedule: string | number[];
    schedule_type: 'crontab' | 'interval';
    timezone: string | null;
  };
  dateCreated: string;
  environments: {
    activeIncident: {
      brokenNotice: {
        environmentMutedTimestamp: string;
        userNotifiedTimestamp: string;
      } | null;
      resolvingTimestamp: string;
      startingTimestamp: string;
    } | null;
    dateCreated: string;
    isMuted: boolean;
    lastCheckIn: string;
    name: string;
    nextCheckIn: string;
    nextCheckInLatest: string;
    status: string;
  };
  id: string;
  isMuted: boolean;
  isUpserting: boolean;
  name: string;
  owner: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  };
  project: {
    access: string[];
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    color: string;
    dateCreated: string;
    features: string[];
    firstEvent: string | null;
    firstTransactionEvent: boolean;
    hasAccess: boolean;
    hasFeedbacks: boolean;
    hasFlags: boolean;
    hasInsightsAgentMonitoring: boolean;
    hasInsightsAppStart: boolean;
    hasInsightsAssets: boolean;
    hasInsightsCaches: boolean;
    hasInsightsDb: boolean;
    hasInsightsHttp: boolean;
    hasInsightsMCP: boolean;
    hasInsightsQueues: boolean;
    hasInsightsScreenLoad: boolean;
    hasInsightsVitals: boolean;
    hasLogs: boolean;
    hasMinifiedStackTrace: boolean;
    hasMonitors: boolean;
    hasNewFeedbacks: boolean;
    hasProfiles: boolean;
    hasReplays: boolean;
    hasSessions: boolean;
    hasTraceMetrics: boolean;
    id: string;
    isBookmarked: boolean;
    isInternal: boolean;
    isMember: boolean;
    isPublic: boolean;
    name: string;
    platform: string | null;
    slug: string;
    status: string;
    sessionStats?: unknown;
    stats?: unknown;
    transactionStats?: unknown;
  };
  slug: string;
  status: string;
  alertRule?: {
    environment: string;
    targets: Array<{
      targetIdentifier: number;
      targetType: string;
    }>;
  };
}>;

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type MonitorValidator = {
  config: ConfigValidator;
  name: string;
  project: string;
  alert_rule?: MonitorAlertRuleValidator;
  is_muted?: boolean;
  owner?: string | null;
  slug?: string;
  status?: 'active' | 'disabled';
};

export type Note = {
  text: string;
  external_id?: string | null;
  mentions?: string[];
};

/** Django Rest Framework serializer for incoming NotificationAction API payloads */
export type NotificationAction = {
  service_type: string;
  trigger_type: string;
  integration_id?: number;
  projects?: string[];
  sentry_app_id?: number;
  target_display?: string;
  target_identifier?: string;
  target_type?: string;
};

export type OrgReleaseResponse = {
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
};

export type OrganizationConfigIntegrationsEndpointResponse = {
  providers: Array<{
    canAdd: boolean;
    canDisable: boolean;
    features: string[];
    key: string;
    metadata: unknown;
    name: string;
    slug: string;
  }>;
};

export type OrganizationDetailsPut = {
  alertsMemberWrite?: boolean;
  allowJoinRequests?: boolean;
  allowSharedIssues?: boolean;
  apdexThreshold?: number;
  attachmentsRole?: 'member' | 'admin' | 'manager' | 'owner';
  avatar?: string;
  avatarType?: 'letter_avatar' | 'upload';
  cancelDeletion?: boolean;
  dataScrubber?: boolean;
  dataScrubberDefaults?: boolean;
  debugFilesRole?: 'member' | 'admin' | 'manager' | 'owner';
  defaultRole?: 'member' | 'admin' | 'manager' | 'owner';
  enhancedPrivacy?: boolean;
  eventsMemberAdmin?: boolean;
  hasGranularReplayPermissions?: boolean;
  hideAiFeatures?: boolean;
  isEarlyAdopter?: boolean;
  issueAlertsThreadFlag?: boolean;
  metricAlertsThreadFlag?: boolean;
  name?: string;
  openMembership?: boolean;
  relayDsnEndpoint?: string | null;
  relayPiiConfig?: string;
  replayAccessMembers?: number[] | null;
  require2FA?: boolean;
  safeFields?: string[];
  scrapeJavaScript?: boolean;
  scrubIPAddresses?: boolean;
  sensitiveFields?: string[];
  slug?: string;
  storeCrashReports?: 0 | 1 | 5 | 10 | 20 | 50 | 100 | -1;
  trustedRelays?: Array<Record<string, unknown>>;
};

export type OrganizationEnvironmentResponse = Array<{
  id: string;
  name: string;
}>;

export type OrganizationEventsFacetsResponse = Array<{
  key: string;
  topValues: Array<{
    count: number;
    name: string;
    value: number | string;
  }>;
}>;

export type OrganizationEventsMetaResponse = {
  count: number;
};

export type OrganizationEventsResponseDict = {
  data: Array<Record<string, unknown>>;
  meta: {
    bytesScanned?: number;
    dataScanned?: string;
    dataset?: string;
    datasetReason?: string;
    debug_info?: unknown;
    discoverSplitDecision?: unknown;
    fields?: Record<string, string>;
    isMetricsData?: boolean;
    isMetricsExtractedData?: boolean;
    tips?: Record<string, string>;
    units?: Record<string, string | null>;
  };
};

export type OrganizationEventsStatsResponse =
  | {
      data: unknown[];
      comparisonCount?: number;
      confidence?: unknown[];
      end?: number;
      isMetricsData?: boolean;
      isMetricsExtractedData?: boolean;
      meta?: Record<string, unknown>;
      order?: number;
      start?: number;
      totals?: Record<string, unknown>;
    }
  | Record<
      string,
      {
        data: unknown[];
        comparisonCount?: number;
        confidence?: unknown[];
        end?: number;
        isMetricsData?: boolean;
        isMetricsExtractedData?: boolean;
        meta?: Record<string, unknown>;
        order?: number;
        start?: number;
        totals?: Record<string, unknown>;
      }
    >;

export type OrganizationEventsTimeseriesResponse = {
  timeSeries: Array<{
    meta: {
      interval: number;
      valueType: string;
      valueUnit: string | null;
      dataScanned?: 'partial' | 'full';
      isOther?: boolean;
      order?: number;
    };
    values: Array<{
      incomplete: boolean;
      timestamp: number;
      value: number;
      comparisonValue?: number;
      confidence?: 'low' | 'high' | null;
      incompleteReason?: string;
      sampleCount?: number;
      sampleRate?: number | null;
    }>;
    yAxis: string;
    groupBy?: Array<{
      key: string;
      value: string | number | Record<string, unknown> | null;
    }>;
  }>;
  meta?: {
    dataset: string;
    end: number;
    start: number;
    annotations?: Array<{
      category: string;
      droppedCount: number;
      end: number;
      label: string;
      reason: string;
      start: number;
      type: 'system';
    }>;
  };
};

export type OrganizationGroupIndexGetResponse = Array<{
  annotations: Array<{
    displayName: string;
    url: string;
  }>;
  assignedTo: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  } | null;
  count: string;
  culprit: string | null;
  derivedData: {
    blocker: string;
    hasOpenFixPr: boolean;
    hasRootCause: boolean;
    isAssigned: boolean;
    lastCompletedAutofixStep: string;
    lastProgressedAt: string | null;
    progress: string;
    status: string;
    viewCount: number;
  };
  filtered: {
    count: string;
    firstSeen: string | null;
    lastSeen: string | null;
    stats: Record<string, unknown>;
    userCount: number;
  } | null;
  firstSeen: string | null;
  hasSeen: boolean;
  id: string;
  inbox: {
    date_added: string;
    reason: number;
    reason_details: {
      count: number | null;
      until: string | null;
      user_count: number | null;
      user_window: number | null;
      window: number | null;
    } | null;
  };
  integrationIssues: Array<Record<string, unknown>>;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  isUnhandled: boolean;
  issueCategory: string;
  issueType: string;
  lastSeen: string | null;
  latestEventHasAttachments: boolean;
  level: 'sample' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
  lifetime: Record<string, unknown>;
  logger: string | null;
  matchingEventEnvironment: string | null;
  matchingEventId: string | null;
  metadata: Record<string, unknown>;
  numComments: number;
  owners: {
    date_added: string;
    owner: string;
    type: string;
  };
  permalink: string;
  platform: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  priorityLockedAt: string | null;
  project: {
    id: string;
    name: string;
    platform: string | null;
    slug: string;
  };
  seerAutofixLastTriggered: string | null;
  seerExplorerAutofixLastTriggered: string | null;
  seerFixabilityScore: number | null;
  sentryAppIssues: Array<Record<string, unknown>>;
  sessionCount: number;
  shareId: string | null;
  shortId: string;
  stats: Record<string, unknown>;
  status:
    | 'resolved'
    | 'ignored'
    | 'pending_deletion'
    | 'pending_merge'
    | 'reprocessing'
    | 'unresolved';
  statusDetails: {
    actor?: {
      avatarUrl: string;
      dateJoined: string;
      email: string;
      emails: Array<{
        email: string;
        id: string;
        is_verified: boolean;
      }>;
      experiments: Record<string, unknown>;
      has2fa: boolean;
      hasPasswordAuth: boolean;
      id: string;
      isActive: boolean;
      isManaged: boolean;
      isStaff: boolean;
      isSuperuser: boolean;
      isSuspended: boolean;
      lastActive: string | null;
      lastLogin: string | null;
      name: string;
      username: string;
      authenticators?: unknown[];
      avatar?: {
        avatarType?: string;
        avatarUrl?: string | null;
        avatarUuid?: string | null;
      };
      canReset2fa?: boolean;
      identities?: Array<{
        dateSynced: string;
        dateVerified: string;
        id: string;
        name: string;
        organization: {
          name: string;
          slug: string;
        };
        provider: {
          id: string;
          name: string;
        };
      }>;
    };
    ignoreCount?: number;
    ignoreUntil?: string;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
    inCommit?: string;
    inNextRelease?: boolean;
    inRelease?: string;
    info?: {
      dateCreated: string;
      syncCount: number;
      totalEvents: number;
    } | null;
    pendingEvents?: number;
  };
  subscriptionDetails: {
    disabled?: boolean;
    reason?: string;
  } | null;
  substatus:
    | 'archived_until_escalating'
    | 'archived_until_condition_met'
    | 'archived_forever'
    | 'escalating'
    | 'ongoing'
    | 'regressed'
    | 'new'
    | null;
  title: string;
  type:
    | 'default'
    | 'error'
    | 'csp'
    | 'nel'
    | 'hpkp'
    | 'expectct'
    | 'expectstaple'
    | 'transaction'
    | 'generic'
    | 'feedback';
  userCount: number;
}>;

export type OrganizationGroupIndexPutResponse = {
  assignedTo?: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  };
  discard?: boolean;
  hasSeen?: boolean;
  inbox?: boolean;
  isBookmarked?: boolean;
  isPublic?: boolean;
  isSubscribed?: boolean;
  merge?: {
    children: string[];
    parent: string;
  };
  priority?: string;
  shareId?: string;
  status?: string;
  statusDetails?: {
    ignoreCount?: number;
    ignoreDuration?: number;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
    inCommit?: {
      commit: string;
      repository: string;
    };
    inNextRelease?: boolean;
    inRelease?: string;
  };
  subscriptionDetails?: {
    disabled?: boolean;
    reason?: string;
  };
  substatus?: string;
};

export type OrganizationIntegrationResponse = {
  accountType: string | null;
  configData: unknown;
  configOrganization: unknown;
  domainName: string | null;
  externalId: string;
  gracePeriodEnd: string | null;
  icon: string | null;
  id: string;
  name: string;
  organizationId: number;
  organizationIntegrationStatus: string;
  outOfDate: boolean | null;
  provider: unknown;
  scopes: string[] | null;
  status: string;
};

export type OrganizationIssueView = {
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  dateCreated: string;
  dateUpdated: string;
  environments: string[];
  id: string;
  lastVisited: string | null;
  name: string;
  projects: number[];
  query: string;
  querySort: 'date' | 'new' | 'trends' | 'freq' | 'user' | 'inbox' | 'recommended';
  starred: boolean;
  stars: number;
  timeFilters: {
    end?: string | null;
    period?: string | null;
    start?: string | null;
    utc?: boolean | null;
  };
};

export type OrganizationIssueViewList = Array<{
  createdBy: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  dateCreated: string;
  dateUpdated: string;
  environments: string[];
  id: string;
  lastVisited: string | null;
  name: string;
  projects: number[];
  query: string;
  querySort: 'date' | 'new' | 'trends' | 'freq' | 'user' | 'inbox' | 'recommended';
  starred: boolean;
  stars: number;
  timeFilters: {
    end?: string | null;
    period?: string | null;
    start?: string | null;
    utc?: boolean | null;
  };
}>;

export type OrganizationMember = {
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  inviterName: string | null;
  name: string;
  orgRole: string;
  pending: boolean;
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
};

export type OrganizationMemberRequest = {
  email: string;
  orgRole?: 'billing' | 'member' | 'manager' | 'owner' | 'admin';
  regenerate?: boolean;
  reinvite?: boolean;
  role?: 'member' | 'admin' | 'manager' | 'owner';
  sendInvite?: boolean;
  teamRoles?: Array<Record<string, unknown>> | null;
  teams?: unknown[];
};

/**
 * Conforming to the SCIM RFC, this represents a Sentry Org Member
 * as a SCIM user object.
 */
export type OrganizationMemberSCIM = {
  emails: Array<{
    primary: boolean;
    type: string;
    value: string;
  }>;
  id: string;
  meta: {
    resourceType: string;
  };
  name: {
    familyName: string;
    givenName: string;
  };
  schemas: string[];
  sentryOrgRole: string;
  userName: string;
  active?: boolean;
};

export type OrganizationMemberTeam = {
  teamRole?: 'contributor' | 'admin';
};

export type OrganizationMemberTeamDetails = {
  isActive: boolean;
  teamRole: 'contributor' | 'admin';
};

export type OrganizationMemberWithRoles = {
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: string;
  invite_link: string | null;
  inviterName: string | null;
  isOnlyOwner: boolean;
  name: string;
  orgRole: string;
  orgRoleList: Array<{
    allowed: boolean;
    desc: string;
    id: string;
    isAllowed: boolean;
    isGlobal: boolean;
    isRetired: boolean;
    isTeamRolesAllowed: boolean;
    is_global: boolean;
    minimumTeamRole: string;
    name: string;
    scopes: string[];
  }>;
  pending: boolean;
  teamRoleList: Array<{
    allowed: boolean;
    desc: string;
    id: string;
    isAllowed: boolean;
    isMinimumRoleFor: string | null;
    isRetired: boolean;
    isTeamRolesAllowed: boolean;
    name: string;
    scopes: string[];
  }>;
  teamRoles: Array<{
    role: string | null;
    teamSlug: string;
  }>;
  teams: string[];
  user: {
    avatarUrl: string;
    dateJoined: string;
    email: string;
    emails: Array<{
      email: string;
      id: string;
      is_verified: boolean;
    }>;
    experiments: Record<string, unknown>;
    has2fa: boolean;
    hasPasswordAuth: boolean;
    id: string;
    isActive: boolean;
    isManaged: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    isSuspended: boolean;
    lastActive: string | null;
    lastLogin: string | null;
    name: string;
    username: string;
    authenticators?: unknown[];
    avatar?: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    canReset2fa?: boolean;
    identities?: Array<{
      dateSynced: string;
      dateVerified: string;
      id: string;
      name: string;
      organization: {
        name: string;
        slug: string;
      };
      provider: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  externalUsers?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
  role?: string;
  roleName?: string;
};

export type OrganizationProfilingChunkAttachmentsResponse = Array<{
  chunkId: string;
  contentType: string | null;
  dateAdded: string;
  id: string;
  name: string;
  profilerId: string;
}>;

export type OrganizationProfilingChunksResponse = Record<string, unknown>;

export type OrganizationProfilingFlamegraphResponse = Record<string, unknown>;

export type OrganizationProjectResponseDict = Array<{
  access: string[];
  dateCreated: string;
  environments: string[];
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  hasUserReports: boolean;
  id: string;
  isBookmarked: boolean;
  isMember: boolean;
  latestRelease: {
    version: string;
  } | null;
  name: string;
  platform: string | null;
  platforms: string[];
  slug: string;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  latestDeploys?: Record<string, Record<string, string>> | null;
  options?: Record<string, unknown>;
  sessionStats?: unknown;
  stats?: unknown;
  transactionStats?: unknown;
}>;

export type OrganizationRelayResponse = Array<{
  firstSeen: string;
  lastSeen: string;
  publicKey: string | null;
  relayId: string;
  version: string;
}>;

export type OrganizationRelease = {
  commits?: Commit[];
  dateReleased?: string | null;
  headCommits?: ReleaseHeadCommitSerializerDeprecated[];
  ref?: string | null;
  refs?: ReleaseHeadCommit[];
  status?: string;
  url?: string | null;
};

export type OrganizationReleaseAssemble = {
  checksum: string;
  chunks: string[];
};

export type OrganizationReleaseTimeseriesResponse = Array<{
  date: string;
  version: string;
}>;

export type OrganizationSamplingEffectiveSampleRateResponse = {
  eapEffectiveSampleRate: number | null;
  effectiveSampleRate: number | null;
};

export type OrganizationSentryAppDetailsResponse = Array<{
  allowedOrigins: string[];
  avatars: Array<{
    avatarType: string;
    avatarUrl: string;
    avatarUuid: string;
    color: boolean;
    photoType: string;
  }>;
  events: string[];
  featureData: string[];
  isAlertable: boolean;
  metadata: string;
  name: string;
  schema: string;
  scopes: string[];
  slug: string;
  status: string;
  uuid: string;
  verifyInstall: boolean;
  webhookEvents: string[];
  webhookHeaders: string[];
  author?: string | null;
  clientId?: string;
  clientSecret?: string | null;
  datePublished?: string;
  isDisabled?: boolean;
  overview?: string | null;
  owner?: {
    id: number;
    slug: string;
  };
  popularity?: number | null;
  redirectUrl?: string | null;
  webhookUrl?: string | null;
}>;

export type OrganizationStatsSummaryResponse = {
  end: string;
  projects: Array<{
    id: string;
    slug: string;
    stats: Array<Record<string, unknown>>;
  }>;
  start: string;
};

export type OrganizationSummary = {
  allowMemberInvite: boolean;
  allowMemberProjectCreation: boolean;
  allowSuperuserAccess: boolean;
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string;
  hasAuthProvider: boolean;
  id: string;
  isEarlyAdopter: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    id: string;
    name: string;
  };
  access?: string[];
  extraOptions?: Record<string, Record<string, unknown>>;
  features?: string[];
  onboardingTasks?: Array<{
    completionSeen: string | null;
    data: unknown;
    dateCompleted: string;
    status: string;
    task: string | null;
  }>;
};

export type OrganizationTraceMetaResponse = {
  errorsCount: number;
  logsCount: number;
  metricsCount: number;
  performanceIssuesCount: number;
  spansCount: number;
  spansCountMap: Record<string, number>;
  transactionChildCountMap: Array<Record<string, unknown>>;
  uptimeCount?: number;
};

export type OrganizationTraceResponse = Array<
  | {
      browser_web_vital: Record<string, number>;
      children: Array<{
        description: string;
        event_id: string;
        project_id: number;
        project_slug: string;
        transaction: string;
      }>;
      description: string;
      duration: number;
      end_timestamp: number;
      errors: Array<{
        culprit: string | null;
        description: string;
        event_id: string;
        event_type: 'error' | 'occurrence';
        issue_id: number;
        issue_type: number;
        level: string;
        project_id: number;
        project_slug: string;
        short_id: string | null;
        start_timestamp: number;
        transaction: string;
        end_timestamp?: number;
      }>;
      event_id: string;
      event_type: 'span';
      is_transaction: boolean;
      measurements: Record<string, number>;
      mobile_app_vital: Record<string, number>;
      name: string;
      occurrences: Array<{
        culprit: string | null;
        description: string;
        event_id: string;
        event_type: 'error' | 'occurrence';
        issue_id: number;
        issue_type: number;
        level: string;
        project_id: number;
        project_slug: string;
        short_id: string | null;
        start_timestamp: number;
        transaction: string;
        end_timestamp?: number;
      }>;
      op: string;
      parent_span_id: string | null;
      profile_id: string;
      profiler_id: string;
      project_id: number;
      project_slug: string;
      sdk_name: string;
      start_timestamp: number;
      transaction: string;
      transaction_id: string;
      additional_attributes?: Record<string, unknown>;
    }
  | {
      culprit: string | null;
      description: string;
      event_id: string;
      event_type: 'error' | 'occurrence';
      issue_id: number;
      issue_type: number;
      level: string;
      project_id: number;
      project_slug: string;
      short_id: string | null;
      start_timestamp: number;
      transaction: string;
      end_timestamp?: number;
    }
  | {
      additional_attributes: Record<string, unknown>;
      children: Array<{
        description: string;
        event_id: string;
        project_id: number;
        project_slug: string;
        transaction: string;
      }>;
      description: string;
      duration: number;
      end_timestamp: number;
      errors: Array<{
        culprit: string | null;
        description: string;
        event_id: string;
        event_type: 'error' | 'occurrence';
        issue_id: number;
        issue_type: number;
        level: string;
        project_id: number;
        project_slug: string;
        short_id: string | null;
        start_timestamp: number;
        transaction: string;
        end_timestamp?: number;
      }>;
      event_id: string;
      event_type: 'uptime_check';
      name: string;
      occurrences: Array<{
        culprit: string | null;
        description: string;
        event_id: string;
        event_type: 'error' | 'occurrence';
        issue_id: number;
        issue_type: number;
        level: string;
        project_id: number;
        project_slug: string;
        short_id: string | null;
        start_timestamp: number;
        transaction: string;
        end_timestamp?: number;
      }>;
      op: string;
      project_id: number;
      project_slug: string;
      region_name: string;
      start_timestamp: number;
      transaction: string;
      transaction_id: string;
    }
>;

export type OrganizationWithProjectsAndTeams = {
  aggregatedDataConsent: boolean;
  alertsMemberWrite: boolean;
  allowJoinRequests: boolean;
  allowMemberInvite: boolean;
  allowMemberProjectCreation: boolean;
  allowSharedIssues: boolean;
  allowSuperuserAccess: boolean;
  attachmentsRole: string;
  autoEnableCodeReview: boolean;
  autoOpenPrs: boolean;
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  dateCreated: string;
  debugFilesRole: string;
  defaultAutofixAutomationTuning: string;
  defaultAutomatedRunStoppingPoint: string;
  defaultCodeReviewTriggers: string[];
  defaultCodingAgent: string;
  defaultCodingAgentIntegrationId: string | null;
  defaultRole: string;
  defaultSeerScannerAutomation: boolean;
  enableSeerCoding: boolean;
  enhancedPrivacy: boolean;
  eventsMemberAdmin: boolean;
  experiments: Record<string, string>;
  hasAuthProvider: boolean;
  hideAiFeatures: boolean;
  id: string;
  isDefault: boolean;
  isDynamicallySampled: boolean;
  isEarlyAdopter: boolean;
  issueAlertsThreadFlag: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  metricAlertsThreadFlag: boolean;
  name: string;
  openMembership: boolean;
  orgRoleList: Array<{
    allowed: boolean;
    desc: string;
    id: string;
    isAllowed: boolean;
    isGlobal: boolean;
    isRetired: boolean;
    isTeamRolesAllowed: boolean;
    is_global: boolean;
    minimumTeamRole: string;
    name: string;
    scopes: string[];
  }>;
  pendingAccessRequests: number;
  projects: Array<{
    access: string[];
    dateCreated: string;
    environments: string[];
    features: string[];
    firstEvent: string | null;
    firstTransactionEvent: boolean;
    hasAccess: boolean;
    hasFeedbacks: boolean;
    hasFlags: boolean;
    hasInsightsAgentMonitoring: boolean;
    hasInsightsAppStart: boolean;
    hasInsightsAssets: boolean;
    hasInsightsCaches: boolean;
    hasInsightsDb: boolean;
    hasInsightsHttp: boolean;
    hasInsightsMCP: boolean;
    hasInsightsQueues: boolean;
    hasInsightsScreenLoad: boolean;
    hasInsightsVitals: boolean;
    hasLogs: boolean;
    hasMinifiedStackTrace: boolean;
    hasMonitors: boolean;
    hasNewFeedbacks: boolean;
    hasProfiles: boolean;
    hasReplays: boolean;
    hasSessions: boolean;
    hasTraceMetrics: boolean;
    hasUserReports: boolean;
    id: string;
    isBookmarked: boolean;
    isMember: boolean;
    latestRelease: {
      version: string;
    } | null;
    name: string;
    platform: string | null;
    platforms: string[];
    slug: string;
    team: {
      id: string;
      name: string;
      slug: string;
    } | null;
    teams: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
    latestDeploys?: Record<string, Record<string, string>> | null;
    options?: Record<string, unknown>;
    sessionStats?: unknown;
    stats?: unknown;
    transactionStats?: unknown;
  }>;
  relayDsnEndpoint: string | null;
  relayPiiConfig: string | null;
  require2FA: boolean;
  requiresSso: boolean;
  safeFields: string[];
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  sensitiveFields: string[];
  slug: string;
  status: {
    id: string;
    name: string;
  };
  storeCrashReports: number;
  teamRoleList: Array<{
    allowed: boolean;
    desc: string;
    id: string;
    isAllowed: boolean;
    isMinimumRoleFor: string | null;
    isRetired: boolean;
    isTeamRolesAllowed: boolean;
    name: string;
    scopes: string[];
  }>;
  teams: Array<{
    access: string[];
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    dateCreated: string | null;
    flags: Record<string, unknown>;
    hasAccess: boolean;
    id: string;
    isMember: boolean;
    isPending: boolean;
    memberCount: number;
    name: string;
    slug: string;
    teamRole: string | null;
    externalTeams?: Array<{
      externalName: string;
      id: string;
      integrationId: string;
      provider: string;
      externalId?: string;
      teamId?: string;
      userId?: string;
    }>;
    organization?: {
      allowMemberInvite: boolean;
      allowMemberProjectCreation: boolean;
      allowSuperuserAccess: boolean;
      avatar: {
        avatarType?: string;
        avatarUrl?: string | null;
        avatarUuid?: string | null;
      };
      dateCreated: string;
      hasAuthProvider: boolean;
      id: string;
      isEarlyAdopter: boolean;
      links: {
        organizationUrl: string;
        regionUrl: string;
      };
      name: string;
      require2FA: boolean;
      slug: string;
      status: {
        id: string;
        name: string;
      };
      access?: string[];
      extraOptions?: Record<string, Record<string, unknown>>;
      features?: string[];
      onboardingTasks?: Array<{
        completionSeen: string | null;
        data: unknown;
        dateCompleted: string;
        status: string;
        task: string | null;
      }>;
    };
    projects?: Array<{
      access: string[];
      avatar: {
        avatarType?: string;
        avatarUrl?: string | null;
        avatarUuid?: string | null;
      };
      color: string;
      dateCreated: string;
      features: string[];
      firstEvent: string | null;
      firstTransactionEvent: boolean;
      hasAccess: boolean;
      hasFeedbacks: boolean;
      hasFlags: boolean;
      hasInsightsAgentMonitoring: boolean;
      hasInsightsAppStart: boolean;
      hasInsightsAssets: boolean;
      hasInsightsCaches: boolean;
      hasInsightsDb: boolean;
      hasInsightsHttp: boolean;
      hasInsightsMCP: boolean;
      hasInsightsQueues: boolean;
      hasInsightsScreenLoad: boolean;
      hasInsightsVitals: boolean;
      hasLogs: boolean;
      hasMinifiedStackTrace: boolean;
      hasMonitors: boolean;
      hasNewFeedbacks: boolean;
      hasProfiles: boolean;
      hasReplays: boolean;
      hasSessions: boolean;
      hasTraceMetrics: boolean;
      id: string;
      isBookmarked: boolean;
      isInternal: boolean;
      isMember: boolean;
      isPublic: boolean;
      name: string;
      platform: string | null;
      slug: string;
      status: string;
      sessionStats?: unknown;
      stats?: unknown;
      transactionStats?: unknown;
    }>;
  }>;
  trustedRelays: Array<{
    created?: string;
    description?: string;
    lastModified?: string;
    name?: string;
    publicKey?: string;
  }>;
  access?: string[];
  desiredSampleRate?: number;
  extraOptions?: Record<string, Record<string, unknown>>;
  features?: string[];
  onboardingTasks?: Array<{
    completionSeen: string | null;
    data: unknown;
    dateCompleted: string;
    status: string;
    task: string | null;
  }>;
  orgRole?: string;
  planSampleRate?: number;
  role?: unknown;
  samplingMode?: string;
  targetSampleRate?: number;
};

export type OutcomesResponse = {
  end: string;
  groups: Array<{
    by: Record<string, unknown>;
    series: Record<string, unknown>;
    totals: Record<string, unknown>;
  }>;
  intervals: string[];
  start: string;
};

export type OutgoingNotificationAction = {
  id: number;
  integrationId: number | null;
  organizationId: number;
  projects: number[];
  sentryAppId: number | null;
  serviceType: string | null;
  targetDisplay: string | null;
  targetIdentifier: string | null;
  targetType: string | null;
  triggerType: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type PathMapping = {
  source_url: string;
  stack_path: string;
};

export type PlatformExternalIssue = {
  identifier: string;
  project: string;
  webUrl: string;
};

export type PlatformExternalIssueResponse = {
  displayName: string;
  id: string;
  issueId: string;
  serviceType: string;
  webUrl: string;
};

export type Project = {
  access: string[];
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  color: string;
  dateCreated: string;
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  id: string;
  isBookmarked: boolean;
  isInternal: boolean;
  isMember: boolean;
  isPublic: boolean;
  name: string;
  platform: string | null;
  slug: string;
  status: string;
  sessionStats?: unknown;
  stats?: unknown;
  transactionStats?: unknown;
};

export type ProjectAdmin = {
  digestsMaxDelay: number;
  digestsMinDelay: number;
  securityToken: string;
  securityTokenHeader: string;
  allowedDomains?: string[];
  autofixAutomationTuning?: 'off' | 'super_low' | 'low' | 'medium' | 'high' | 'always';
  builtinSymbolSources?: string[];
  copy_from_project?: number;
  dataScrubber?: boolean;
  dataScrubberDefaults?: boolean;
  debugFilesRole?: 'member' | 'admin' | 'manager' | 'owner' | null;
  defaultEnvironment?: string | null;
  dynamicSamplingBiases?: DynamicSamplingBias[];
  enableAutoReleaseCreation?: boolean;
  fingerprintingRules?: string | null;
  groupingConfig?: string | null;
  groupingEnhancements?: string | null;
  highlightContext?: Record<string, unknown>;
  highlightTags?: string[];
  isBookmarked?: boolean;
  name?: string;
  platform?: string | null;
  preprodDistributionEnabledByCustomer?: boolean | null;
  preprodDistributionEnabledQuery?: string | null;
  preprodDistributionPrCommentsEnabledByCustomer?: boolean | null;
  preprodSizeEnabledByCustomer?: boolean | null;
  preprodSizeEnabledQuery?: string | null;
  preprodSizePrCommentsEnabled?: boolean;
  preprodSizePrCommentsRules?: Record<string, unknown>;
  preprodSizeStatusChecksEnabled?: boolean;
  preprodSizeStatusChecksRules?: Record<string, unknown>;
  preprodSnapshotPrCommentsEnabled?: boolean | null;
  preprodSnapshotPrCommentsPostOnAdded?: boolean | null;
  preprodSnapshotPrCommentsPostOnChanged?: boolean | null;
  preprodSnapshotPrCommentsPostOnRemoved?: boolean | null;
  preprodSnapshotPrCommentsPostOnRenamed?: boolean | null;
  preprodSnapshotStatusChecksEnabled?: boolean;
  preprodSnapshotStatusChecksFailOnAdded?: boolean;
  preprodSnapshotStatusChecksFailOnChanged?: boolean;
  preprodSnapshotStatusChecksFailOnRemoved?: boolean;
  preprodSnapshotStatusChecksFailOnRenamed?: boolean;
  relayPiiConfig?: string | null;
  resolveAge?: number | null;
  safeFields?: string[];
  scmSourceContextEnabled?: boolean;
  scrapeJavaScript?: boolean;
  scrubIPAddresses?: boolean;
  secondaryGroupingConfig?: string | null;
  secondaryGroupingExpiry?: number | null;
  seerScannerAutomation?: boolean;
  sensitiveFields?: string[];
  slug?: string;
  storeCrashReports?: number | null;
  subjectPrefix?: string;
  subjectTemplate?: string;
  symbolSources?: string | null;
  targetSampleRate?: number;
  tempestFetchScreenshots?: boolean;
  verifySSL?: boolean;
};

export type ProjectEventDetailsResponse = {
  _meta: Record<string, unknown>;
  context: Record<string, unknown> | null;
  contexts: Record<string, unknown> | null;
  dateReceived: string | null;
  dist: string | null;
  entries: unknown[];
  errors: Array<{
    data: Record<string, unknown>;
    message: string;
    type: string;
  }>;
  eventID: string;
  groupID: string | null;
  id: string;
  location: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  nextEventID: string | null;
  occurrence: {
    assignee: string | null;
    culprit: string | null;
    detectionTime: number;
    eventId: string;
    evidenceData: Record<string, unknown>;
    evidenceDisplay: Array<{
      important: boolean;
      name: string;
      value: string;
    }>;
    fingerprint: string[];
    id: string;
    issueTitle: string;
    level: string | null;
    priority: number | null;
    projectId: number;
    resourceId: string | null;
    subtitle: string;
    type: number;
  } | null;
  packages: Record<string, unknown>;
  platform: string;
  previousEventID: string | null;
  projectID: string;
  release: {
    commitCount?: number;
    data?: Record<string, unknown>;
    dateCreated?: string;
    dateReleased?: string | null;
    deployCount?: number;
    id?: number;
    lastCommit?: Record<string, unknown> | null;
    lastDeploy?: {
      dateFinished: string;
      environment: string;
      id: string;
      name: string;
      dateStarted?: string | null;
      url?: string | null;
    } | null;
    ref?: string | null;
    status?: string;
    url?: string | null;
    userAgent?: string | null;
    version?: string | null;
    versionInfo?: {
      buildHash: string | null;
      package: string | null;
      version: Record<string, unknown>;
      description?: string;
    } | null;
  } | null;
  resolvedWith: string[];
  sdk: {
    name: string | null;
    version: string | null;
  } | null;
  sdkUpdates: Array<Record<string, unknown>>;
  size: number | null;
  tags: Array<{
    key: string;
    value: string;
    query?: string;
  }>;
  title: string;
  type:
    | 'default'
    | 'error'
    | 'csp'
    | 'nel'
    | 'hpkp'
    | 'expectct'
    | 'expectstaple'
    | 'transaction'
    | 'generic'
    | 'feedback';
  user: {
    data?: Record<string, unknown> | null;
    email?: string | null;
    geo?: Record<string, string> | null;
    id?: string | null;
    ip_address?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  userReport: {
    comments: string;
    dateCreated: string;
    email: string | null;
    event: {
      eventID: string;
      id: string;
    };
    eventID: string;
    id: string;
    name: string | null;
    user: {
      avatarUrl: string | null;
      email: string | null;
      id: string;
      ipAddress: string | null;
      name: string | null;
      username: string | null;
    } | null;
  } | null;
  breakdowns?: Record<
    string,
    Record<
      string,
      {
        unit: string | null;
        value: number;
      }
    >
  > | null;
  crashFile?: string | null;
  culprit?: string | null;
  dateCreated?: string;
  endTimestamp?: number;
  fingerprints?: string[];
  groupingConfig?: {
    enhancements: string;
    id: string;
  };
  measurements?: Record<
    string,
    {
      unit: string | null;
      value: number;
    }
  > | null;
  startTimestamp?: number;
};

export type ProjectEventsResponseDict = Array<{
  crashFile: string | null;
  culprit: string | null;
  dateCreated: string;
  'event.type': string;
  eventID: string;
  groupID: string | null;
  id: string;
  location: string | null;
  message: string;
  metadata: Record<string, unknown>;
  platform: string | null;
  projectID: string;
  tags: Array<{
    key: string;
    value: string;
    query?: string;
  }>;
  title: string;
  user: {
    data?: Record<string, unknown> | null;
    email?: string | null;
    geo?: Record<string, string> | null;
    id?: string | null;
    ip_address?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
}>;

export type ProjectFilterResponse = Array<{
  active: boolean | string[];
  id: string;
}>;

/** This represents a Sentry Project Client Key. */
export type ProjectKey = {
  browserSdk: {
    choices: Array<string[]>;
  };
  browserSdkVersion: string;
  dateCreated: string | null;
  dsn: {
    cdn: string;
    crons: string;
    csp: string;
    integration: string;
    minidump: string;
    nel: string;
    otlp_logs: string;
    otlp_traces: string;
    playstation: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
    hasFeedback: boolean;
    hasLogsAndMetrics: boolean;
    hasPerformance: boolean;
    hasReplay: boolean;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: number;
  public: string | null;
  rateLimit: {
    count: number;
    window: number;
  } | null;
  secret: string | null;
  useCase?: string;
};

export type ProjectKeyPost = {
  name?: string | null;
  rateLimit?: RateLimit;
  useCase?: 'user' | 'profiling' | 'tempest' | 'demo';
};

export type ProjectOwnership = {
  autoAssignment: string;
  codeownersAutoSync: boolean;
  dateCreated: string;
  fallthrough: boolean;
  isActive: boolean;
  lastUpdated: string;
  raw: string;
  schema?: {
    $version: number;
    rules: Array<{
      matcher: {
        pattern: string;
        type: string;
      };
      owners: Array<{
        name: string;
        type: string;
        id?: string;
      }>;
    }>;
  } | null;
};

export type ProjectOwnershipRequest = {
  autoAssignment?: string;
  codeownersAutoSync?: boolean;
  fallthrough?: boolean;
  raw?: string;
};

export type ProjectPost = {
  name: string;
  default_rules?: boolean;
  platform?: string | null;
  slug?: string | null;
};

export type ProjectProfilingProfileResponse = Record<string, unknown>;

export type ProjectReleaseResponse = {
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
};

export type ProjectReleaseStats = {
  statTotals: Record<string, unknown>;
  stats: Array<number[]>;
  usersBreakdown: Array<{
    crashFreeSessions: number | null;
    crashFreeUsers: number | null;
    date: string;
    totalSessions: number;
    totalUsers: number;
  }>;
};

export type ProjectRepoLinkRequest = {
  repositoryId: number;
};

export type ProjectRepoLinkResponse = {
  created: boolean;
  id: string;
  projectId: string;
  repositoryId: string;
  source: string;
};

export type ProjectRuleDetailsPut = {
  actionMatch: 'all' | 'any' | 'none';
  actions: Array<Record<string, unknown>>;
  conditions: Array<Record<string, unknown>>;
  frequency: number;
  name: string;
  environment?: string | null;
  filterMatch?: 'all' | 'any' | 'none';
  filters?: Array<Record<string, unknown>>;
  owner?: string | null;
};

export type ProjectRulesPost = {
  actionMatch: 'all' | 'any' | 'none';
  actions: Array<Record<string, unknown>>;
  conditions: Array<Record<string, unknown>>;
  frequency: number;
  name: string;
  environment?: string | null;
  filterMatch?: 'all' | 'any' | 'none';
  filters?: Array<Record<string, unknown>>;
  owner?: string | null;
};

export type ProjectSizeStatusCheckRulesResponse = {
  enabled: boolean;
  rules: Array<{
    artifactType:
      | 'main_artifact'
      | 'watch_artifact'
      | 'android_dynamic_feature_artifact'
      | 'app_clip_artifact'
      | 'all_artifacts';
    filterQuery: string;
    filters: Array<{
      conditions: Array<{
        operator:
          | 'contains'
          | 'endsWith'
          | 'equals'
          | 'in'
          | 'matches'
          | 'notContains'
          | 'notEndsWith'
          | 'notEquals'
          | 'notIn'
          | 'notMatches'
          | 'notStartsWith'
          | 'startsWith';
        values: string[];
      }>;
      key: 'app_id' | 'build_configuration_name' | 'git_head_ref' | 'platform_name';
    }> | null;
    id: string;
    measurement: 'absolute' | 'absolute_diff' | 'relative_diff';
    metric: 'install_size' | 'download_size';
    value: string;
  }>;
};

export type ProjectSnapshotStatusCheckRulesResponse = {
  enabled: boolean;
  rules: {
    failOnAdded: boolean;
    failOnChanged: boolean;
    failOnRemoved: boolean;
    failOnRenamed: boolean;
  };
};

export type ProjectStats = Array<number[]>;

export type ProjectSummary = {
  access: string[];
  dateCreated: string;
  environments: string[];
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  hasUserReports: boolean;
  id: string;
  isBookmarked: boolean;
  isMember: boolean;
  latestRelease: {
    version: string;
  } | null;
  name: string;
  platform: string | null;
  platforms: string[];
  slug: string;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  latestDeploys?: Record<string, Record<string, string>> | null;
  options?: Record<string, unknown>;
  sessionStats?: unknown;
  stats?: unknown;
  transactionStats?: unknown;
};

export type ProjectTeamsResponse = Array<{
  access: string[];
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string | null;
  flags: Record<string, unknown>;
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
  teamRole: string | null;
}>;

export type ProjectTransfer = {
  email: string;
};

export type ProjectUserIssueRequest = {
  issueType: 'web_vitals';
  transaction: string;
  timestamp?: string;
  traceId?: string;
};

export type ProjectUserIssueResponse = {
  event_id: string;
};

export type ProjectWithTeam = {
  access: string[];
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  color: string;
  dateCreated: string;
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  id: string;
  isBookmarked: boolean;
  isInternal: boolean;
  isMember: boolean;
  isPublic: boolean;
  name: string;
  platform: string | null;
  slug: string;
  status: string;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  sessionStats?: unknown;
  stats?: unknown;
  team?: {
    id: string;
    name: string;
    slug: string;
  };
  transactionStats?: unknown;
};

export type PromptsActivity = {
  feature: string;
  status: 'snoozed' | 'dismissed' | 'visible';
};

export type PromptsActivityResponse = {
  features: Record<string, unknown>;
  data?: Record<string, unknown> | null;
};

export type Query = {
  mode: 'samples' | 'aggregate';
  aggregateField?: AggregateField[] | null;
  aggregateOrderby?: string | null;
  caseInsensitive?: boolean;
  fields?: string[] | null;
  groupby?: string[] | null;
  metric?: Metric | null;
  orderby?: string | null;
  query?: string | null;
  visualize?: Visualize[] | null;
};

/**
 * Applies a rate limit to cap the number of errors accepted during a given time window. To
 * disable entirely set `rateLimit` to null.
 * ```json
 * {
 *     "rateLimit": {
 *         "window": 7200, // time in seconds
 *         "count": 1000 // error cap
 *     }
 * }
 * ```
 */
export type RateLimit = {
  count?: number | null;
  window?: number | null;
};

export type Release = {
  commits?: Commit[];
  dateReleased?: string | null;
  ref?: string | null;
  status?: string;
  url?: string | null;
};

export type ReleaseAssembleResponse = {
  missingChunks: string[];
  state: string;
  detail?: string | null;
};

export type ReleaseFile = {
  name: string;
};

export type ReleaseFileResponse = {
  dateCreated: string;
  dist: string | null;
  headers: Record<string, unknown>;
  id: string;
  name: string;
  sha1: string;
  size: number;
};

/**
 * Documents the multipart/form-data body of the release file upload endpoints.
 *
 * The endpoints read the upload directly off ``request.data``; this serializer
 * exists to describe the request body in the OpenAPI schema.
 */
export type ReleaseFileUpload = {
  file: string;
  dist?: string;
  header?: string[];
  name?: string;
};

export type ReleaseHeadCommit = {
  commit: string;
  repository: string;
  previousCommit?: string | null;
};

export type ReleaseHeadCommitSerializerDeprecated = {
  currentId: string;
  repository: string;
  previousId?: string | null;
};

export type ReleaseSerializerWithProjects = {
  projects: unknown[];
  version: string;
  commits?: Commit[];
  dateReleased?: string | null;
  headCommits?: ReleaseHeadCommitSerializerDeprecated[];
  owner?: string;
  ref?: string | null;
  refs?: ReleaseHeadCommit[];
  status?: string;
  url?: string | null;
};

export type ReleaseThresholdStatusResponse = Record<
  string,
  Array<{
    end: string;
    is_healthy: boolean;
    key: string;
    metric_value: number | Record<string, unknown> | null;
    project_id: number;
    project_slug: string;
    start: string;
    date_added?: string;
    environment?: Record<string, unknown> | null;
    id?: string;
    project?: Record<string, unknown>;
    release?: string;
    threshold_type?:
      | 'total_error_count'
      | 'new_issue_count'
      | 'unhandled_issue_count'
      | 'regressed_issue_count'
      | 'failure_rate'
      | 'crash_free_session_rate'
      | 'crash_free_user_rate';
    trigger_type?: 'over' | 'under';
    value?: number;
    window_in_seconds?: number;
  }>
>;

export type ReleaseWithVersion = {
  version: string;
  commits?: Commit[];
  dateReleased?: string | null;
  owner?: string;
  ref?: string | null;
  status?: string;
  url?: string | null;
};

export type ReplayCounts = Record<string, number>;

export type ReplayDeletionJobCreate = {
  data: ReplayDeletionJobCreateData;
};

export type ReplayDeletionJobCreateData = {
  environments: string[];
  query: string | null;
  rangeEnd: string;
  rangeStart: string;
};

export type RepoPathParsing = {
  defaultBranch: string;
  integrationId: number;
  provider: string;
  repositoryId: number;
  sourceRoot: string;
  stackRoot: string;
};

/** Span page plus conversation-level metadata. */
export type RetrieveOrganizationAIConversationResponse = {
  conversationId: string;
  projects: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  spans: Array<Record<string, unknown>>;
  title: string | null;
  webUrl: string;
};

/** This represents a Sentry Rule. */
export type Rule = {
  actionMatch: string | null;
  actions: Array<Record<string, unknown>>;
  conditions: Array<Record<string, unknown>>;
  dateCreated: string;
  filterMatch: string | null;
  filters: Array<Record<string, unknown>>;
  frequency: number;
  id: string | null;
  name: string;
  projects: string[];
  snooze: boolean;
  status: 'active' | 'disabled';
  createdBy?: {
    email: string;
    id: number;
    name: string;
  } | null;
  disableDate?: string;
  disableReason?: string;
  environment?: string | null;
  errors?: Array<{
    detail: string;
  }>;
  lastTriggered?: string | null;
  owner?: string | null;
  snoozeCreatedBy?: string | null;
  snoozeForEveryone?: boolean | null;
};

export type RuleGroupHistory = {
  count: number;
  eventId: string | null;
  group: {
    annotations: Array<{
      displayName: string;
      url: string;
    }>;
    assignedTo: {
      id: string;
      name: string;
      type: 'user' | 'team';
      email?: string;
    } | null;
    culprit: string | null;
    hasSeen: boolean;
    id: string;
    isBookmarked: boolean;
    isPublic: boolean;
    isSubscribed: boolean;
    issueCategory: string;
    issueType: string;
    level: 'sample' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
    logger: string | null;
    metadata: Record<string, unknown>;
    numComments: number;
    permalink: string;
    platform: string | null;
    priority: 'low' | 'medium' | 'high' | null;
    priorityLockedAt: string | null;
    project: {
      id: string;
      name: string;
      platform: string | null;
      slug: string;
    };
    seerAutofixLastTriggered: string | null;
    seerExplorerAutofixLastTriggered: string | null;
    seerFixabilityScore: number | null;
    shareId: string | null;
    shortId: string;
    status:
      | 'resolved'
      | 'ignored'
      | 'pending_deletion'
      | 'pending_merge'
      | 'reprocessing'
      | 'unresolved';
    statusDetails: {
      actor?: {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      };
      ignoreCount?: number;
      ignoreUntil?: string;
      ignoreUserCount?: number;
      ignoreUserWindow?: number;
      ignoreWindow?: number;
      inCommit?: string;
      inNextRelease?: boolean;
      inRelease?: string;
      info?: {
        dateCreated: string;
        syncCount: number;
        totalEvents: number;
      } | null;
      pendingEvents?: number;
    };
    subscriptionDetails: {
      disabled?: boolean;
      reason?: string;
    } | null;
    substatus:
      | 'archived_until_escalating'
      | 'archived_until_condition_met'
      | 'archived_forever'
      | 'escalating'
      | 'ongoing'
      | 'regressed'
      | 'new'
      | null;
    title: string;
    type:
      | 'default'
      | 'error'
      | 'csp'
      | 'nel'
      | 'hpkp'
      | 'expectct'
      | 'expectstaple'
      | 'transaction'
      | 'generic'
      | 'feedback';
    count?: string;
    derivedData?: {
      blocker: string;
      hasOpenFixPr: boolean;
      hasRootCause: boolean;
      isAssigned: boolean;
      lastCompletedAutofixStep: string;
      lastProgressedAt: string | null;
      progress: string;
      status: string;
      viewCount: number;
    };
    firstSeen?: string | null;
    isUnhandled?: boolean;
    lastSeen?: string | null;
    userCount?: number;
  };
  lastTriggered: string;
};

export type SCIMListResponseEnvelopeSCIMMemberIndexResponse = {
  Resources: Array<{
    emails: Array<{
      primary: boolean;
      type: string;
      value: string;
    }>;
    id: string;
    meta: {
      resourceType: string;
    };
    name: {
      familyName: string;
      givenName: string;
    };
    schemas: string[];
    sentryOrgRole: string;
    userName: string;
    active?: boolean;
  }>;
  itemsPerPage: number;
  schemas: string[];
  startIndex: number;
  totalResults: number;
};

export type SCIMListResponseEnvelopeSCIMTeamIndexResponse = {
  Resources: Array<{
    displayName: string;
    id: string;
    meta: {
      resourceType: string;
    };
    schemas: string[];
    members?: Array<{
      display: string;
      value: string;
    }>;
  }>;
  itemsPerPage: number;
  schemas: string[];
  startIndex: number;
  totalResults: number;
};

export type SCIMMemberProvision = {
  userName: string;
  sentryOrgRole?: 'billing' | 'member' | 'manager' | 'admin';
};

export type SCIMPatchOperation = {
  op: string;
  value: unknown;
  path?: string;
};

export type SCIMPatchRequest = {
  Operations: SCIMPatchOperation[];
  schemas?: string[];
};

export type SCIMTeamPatchOperation = {
  op: string;
  path?: string;
  value?: Record<string, unknown>;
};

export type SCIMTeamPatchRequest = {
  Operations: SCIMTeamPatchOperation[];
  schemas: string[];
};

export type SCIMTeamRequestBody = {
  displayName: string;
};

/** Response containing list of actively used LLM model names from Seer. */
export type SeerModelsResponse = {
  models: string[];
};

export type SentryAppDetailsResponse = {
  allowedOrigins: string[];
  avatars: Array<{
    avatarType: string;
    avatarUrl: string;
    avatarUuid: string;
    color: boolean;
    photoType: string;
  }>;
  events: string[];
  featureData: string[];
  isAlertable: boolean;
  metadata: string;
  name: string;
  schema: string;
  scopes: string[];
  slug: string;
  status: string;
  uuid: string;
  verifyInstall: boolean;
  webhookEvents: string[];
  webhookHeaders: string[];
  author?: string | null;
  clientId?: string;
  clientSecret?: string | null;
  datePublished?: string;
  isDisabled?: boolean;
  overview?: string | null;
  owner?: {
    id: number;
    slug: string;
  };
  popularity?: number | null;
  redirectUrl?: string | null;
  webhookUrl?: string | null;
};

export type SentryAppInstallation = {
  app: {
    sentryAppId: number;
    slug: string;
    uuid: string;
  };
  code: string;
  organization: {
    id: number;
    slug: string;
  };
  status: string;
  uuid: string;
};

export type SentryAppInstallationParser = {
  status: string;
};

export type SentryAppParser = {
  name: string;
  scopes: string[] | null;
  allowedOrigins?: string[];
  author?: string | null;
  events?: string[] | null;
  features?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 12 | '' | null> | null;
  isAlertable?: boolean;
  isInternal?: boolean;
  overview?: string | null;
  redirectUrl?: string | null;
  schema?: Record<string, unknown> | null;
  verifyInstall?: boolean;
  webhookHeaders?: string[];
  webhookUrl?: string | null;
};

export type SentryAppStats = {
  installStats: Array<number[]>;
  totalInstalls: number;
  totalUninstalls: number;
  uninstallStats: Array<number[]>;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type ServerlessAction = {
  action: 'enable' | 'disable' | 'updateVersion';
  target: string;
};

export type ServerlessFunction = {
  enabled: boolean;
  name: string;
  outOfDate: boolean;
  runtime: string;
  version: number;
};

export type ServiceHook = {
  dateCreated: string;
  events: string[];
  id: string;
  secret: string;
  status: string;
  url: string;
};

export type ServiceHookValidator = {
  url: string;
  events?: string[];
  isActive?: boolean;
  version?: 0;
};

export type SessionsQueryResult = {
  end: string;
  groups: Array<{
    by: {
      environment?: string;
      project?: number;
      release?: string;
      'session.status'?: string;
    };
    series: Record<string, Array<number | null>>;
    totals: Record<string, number | null>;
  }>;
  intervals: string[];
  query: string;
  start: string;
};

export type ShortIdLookupResponse = {
  group: {
    annotations: Array<{
      displayName: string;
      url: string;
    }>;
    assignedTo: {
      id: string;
      name: string;
      type: 'user' | 'team';
      email?: string;
    } | null;
    culprit: string | null;
    hasSeen: boolean;
    id: string;
    isBookmarked: boolean;
    isPublic: boolean;
    isSubscribed: boolean;
    issueCategory: string;
    issueType: string;
    level: 'sample' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
    logger: string | null;
    metadata: Record<string, unknown>;
    numComments: number;
    permalink: string;
    platform: string | null;
    priority: 'low' | 'medium' | 'high' | null;
    priorityLockedAt: string | null;
    project: {
      id: string;
      name: string;
      platform: string | null;
      slug: string;
    };
    seerAutofixLastTriggered: string | null;
    seerExplorerAutofixLastTriggered: string | null;
    seerFixabilityScore: number | null;
    shareId: string | null;
    shortId: string;
    status:
      | 'resolved'
      | 'ignored'
      | 'pending_deletion'
      | 'pending_merge'
      | 'reprocessing'
      | 'unresolved';
    statusDetails: {
      actor?: {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      };
      ignoreCount?: number;
      ignoreUntil?: string;
      ignoreUserCount?: number;
      ignoreUserWindow?: number;
      ignoreWindow?: number;
      inCommit?: string;
      inNextRelease?: boolean;
      inRelease?: string;
      info?: {
        dateCreated: string;
        syncCount: number;
        totalEvents: number;
      } | null;
      pendingEvents?: number;
    };
    subscriptionDetails: {
      disabled?: boolean;
      reason?: string;
    } | null;
    substatus:
      | 'archived_until_escalating'
      | 'archived_until_condition_met'
      | 'archived_forever'
      | 'escalating'
      | 'ongoing'
      | 'regressed'
      | 'new'
      | null;
    title: string;
    type:
      | 'default'
      | 'error'
      | 'csp'
      | 'nel'
      | 'hpkp'
      | 'expectct'
      | 'expectstaple'
      | 'transaction'
      | 'generic'
      | 'feedback';
    count?: string;
    derivedData?: {
      blocker: string;
      hasOpenFixPr: boolean;
      hasRootCause: boolean;
      isAssigned: boolean;
      lastCompletedAutofixStep: string;
      lastProgressedAt: string | null;
      progress: string;
      status: string;
      viewCount: number;
    };
    firstSeen?: string | null;
    isUnhandled?: boolean;
    lastSeen?: string | null;
    userCount?: number;
  };
  groupId: string;
  organizationSlug: string;
  projectSlug: string;
  shortId: string;
};

export type SizeAnalysisResponse = {
  analysisDuration: number | null;
  analysisVersion: string | null;
  appComponents: Array<{
    appId: string;
    componentType: string;
    downloadSize: number;
    installSize: number;
    name: string;
    path: string;
  }> | null;
  appInfo: {
    appId: string | null;
    artifactType: string | null;
    buildNumber: number | null;
    dateAdded: string | null;
    dateBuilt: string | null;
    name: string | null;
    version: string | null;
  };
  baseAppInfo: {
    appId: string | null;
    artifactType: string | null;
    buildNumber: number | null;
    dateAdded: string | null;
    dateBuilt: string | null;
    name: string | null;
    version: string | null;
  } | null;
  baseBuildId: string | null;
  buildId: string;
  comparisons: Array<{
    diffItems: Array<{
      baseSize: number | null;
      diffItems: unknown[] | null;
      headSize: number | null;
      itemType: string | null;
      path: string;
      sizeDiff: number;
      type: string;
    }> | null;
    errorCode: string | null;
    errorMessage: string | null;
    identifier: string | null;
    insightDiffItems: Array<{
      fileDiffs: Array<{
        baseSize: number | null;
        diffItems: unknown[] | null;
        headSize: number | null;
        itemType: string | null;
        path: string;
        sizeDiff: number;
        type: string;
      }>;
      groupDiffs: Array<{
        baseSize: number | null;
        diffItems: unknown[] | null;
        headSize: number | null;
        itemType: string | null;
        path: string;
        sizeDiff: number;
        type: string;
      }>;
      insightType: string;
      status: string;
      totalSavingsChange: number;
    }> | null;
    metricsArtifactType: string;
    sizeMetricDiff: {
      baseDownloadSize: number;
      baseInstallSize: number;
      headDownloadSize: number;
      headInstallSize: number;
      identifier: string | null;
      metricsArtifactType: string;
    } | null;
    state: string;
  }> | null;
  downloadSize: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  gitInfo: {
    baseRef: string | null;
    baseRepoName: string | null;
    baseSha: string | null;
    headRef: string | null;
    headRepoName: string | null;
    headSha: string | null;
    prNumber: number | null;
    provider: string | null;
  } | null;
  insights: Record<string, unknown> | null;
  installSize: number | null;
  state: string;
};

export type SkipStatusCheck = {
  provider: 'github' | 'github_enterprise';
  repository: string;
  sha: string;
};

export type SnapshotCreateResponse = {
  artifactId: string;
  imageCount: number;
  snapshotMetricsId: string;
  snapshotUrl: string;
};

export type SnapshotDetailsResponse = {
  added?: Array<{
    canvas_theme?: 'light' | 'dark' | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    key?: string;
    width?: number;
  }>;
  added_count?: number;
  app_id?: string | null;
  approval_status?: string | null;
  approvers?: Array<{
    approved_at?: string | null;
    avatar_url?: string | null;
    email?: string | null;
    id?: string | null;
    name?: string | null;
    source?: 'sentry' | 'github';
    username?: string | null;
  }>;
  base_artifact_id?: string | null;
  changed?: Array<{
    base_image?: {
      canvas_theme?: 'light' | 'dark' | null;
      display_name?: string | null;
      group?: string | null;
      height?: number;
      image_file_name?: string;
      key?: string;
      width?: number;
    };
    diff?: number | null;
    diff_image_key?: string | null;
    head_image?: {
      canvas_theme?: 'light' | 'dark' | null;
      display_name?: string | null;
      group?: string | null;
      height?: number;
      image_file_name?: string;
      key?: string;
      width?: number;
    };
  }>;
  changed_count?: number;
  comparison_error_message?: string | null;
  comparison_state?: string | null;
  comparison_type?: string;
  diff_threshold?: number | null;
  errored?: Array<{
    base_image?: {
      canvas_theme?: 'light' | 'dark' | null;
      display_name?: string | null;
      group?: string | null;
      height?: number;
      image_file_name?: string;
      key?: string;
      width?: number;
    };
    diff?: number | null;
    diff_image_key?: string | null;
    head_image?: {
      canvas_theme?: 'light' | 'dark' | null;
      display_name?: string | null;
      group?: string | null;
      height?: number;
      image_file_name?: string;
      key?: string;
      width?: number;
    };
  }>;
  errored_count?: number;
  head_artifact_id?: string;
  image_count?: number;
  images?: Array<{
    canvas_theme?: 'light' | 'dark' | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    key?: string;
    width?: number;
  }>;
  is_selective?: boolean;
  project_id?: string;
  removed?: Array<{
    canvas_theme?: 'light' | 'dark' | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    key?: string;
    width?: number;
  }>;
  removed_count?: number;
  renamed?: Array<{
    base_image?: {
      canvas_theme?: 'light' | 'dark' | null;
      display_name?: string | null;
      group?: string | null;
      height?: number;
      image_file_name?: string;
      key?: string;
      width?: number;
    };
    diff?: number | null;
    diff_image_key?: string | null;
    head_image?: {
      canvas_theme?: 'light' | 'dark' | null;
      display_name?: string | null;
      group?: string | null;
      height?: number;
      image_file_name?: string;
      key?: string;
      width?: number;
    };
  }>;
  renamed_count?: number;
  skipped?: Array<{
    canvas_theme?: 'light' | 'dark' | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    key?: string;
    width?: number;
  }>;
  skipped_count?: number;
  state?: string;
  unchanged?: Array<{
    canvas_theme?: 'light' | 'dark' | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    key?: string;
    width?: number;
  }>;
  unchanged_count?: number;
  vcs_info?: {
    base_ref?: string | null;
    base_repo_name?: string | null;
    base_sha?: string | null;
    head_ref?: string | null;
    head_repo_name?: string | null;
    head_sha?: string | null;
    pr_number?: number | null;
    provider?: string | null;
  };
};

export type SnapshotImageDetailResponse = {
  base_image?: {
    canvas_theme?: 'light' | 'dark' | null;
    description?: string | null;
    diff_threshold?: number | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    image_url?: string;
    key?: string;
    tags?: Record<string, string> | null;
    width?: number;
  } | null;
  comparison_status?: string | null;
  diff_image_url?: string | null;
  diff_percentage?: number | null;
  head_image?: {
    canvas_theme?: 'light' | 'dark' | null;
    description?: string | null;
    diff_threshold?: number | null;
    display_name?: string | null;
    group?: string | null;
    height?: number;
    image_file_name?: string;
    image_url?: string;
    key?: string;
    tags?: Record<string, string> | null;
    width?: number;
  } | null;
  image_file_name?: string;
  previous_image_file_name?: string | null;
};

export type Source = {
  name: string;
  type: 'http' | 'gcs' | 's3';
  access_key?: string;
  bucket?: string;
  client_email?: string;
  filters?: Filters;
  id?: string;
  layout?: Layout;
  password?: string;
  prefix?: string;
  private_key?: string;
  region?:
    | 'us-east-2'
    | 'us-east-1'
    | 'us-west-1'
    | 'us-west-2'
    | 'ap-east-1'
    | 'ap-south-1'
    | 'ap-northeast-2'
    | 'ap-southeast-1'
    | 'ap-southeast-2'
    | 'ap-northeast-1'
    | 'ca-central-1'
    | 'cn-north-1'
    | 'cn-northwest-1'
    | 'eu-central-1'
    | 'eu-west-1'
    | 'eu-west-2'
    | 'eu-west-3'
    | 'eu-north-1'
    | 'sa-east-1'
    | 'us-gov-east-1'
    | 'us-gov-west-1';
  secret_key?: string;
  url?: string;
  username?: string;
};

export type SourceMapDebug = {
  dist: string | null;
  exceptions: Array<{
    frames: Array<{
      debug_id_process: {
        debug_id: string | null;
        uploaded_source_file_with_correct_debug_id: boolean;
        uploaded_source_map_with_correct_debug_id: boolean;
      };
      release_process: {
        abs_path: string;
        matching_source_file_names: string[];
        matching_source_map_name: string | null;
        source_file_lookup_result: 'found' | 'wrong-dist' | 'unsuccessful';
        source_map_lookup_result: 'found' | 'wrong-dist' | 'unsuccessful';
        source_map_reference: string | null;
      } | null;
      scraping_process: {
        source_file:
          | {
              status: 'success';
              url: string;
            }
          | {
              status: 'not_attempted';
              url: string;
            }
          | {
              details: string | null;
              reason:
                | 'not_found'
                | 'disabled'
                | 'invalid_host'
                | 'permission_denied'
                | 'timeout'
                | 'download_error'
                | 'other';
              status: 'failure';
              url: string;
            }
          | Record<string, unknown>
          | null;
        source_map:
          | {
              status: 'success';
              url: string;
            }
          | {
              status: 'not_attempted';
              url: string;
            }
          | {
              details: string | null;
              reason:
                | 'not_found'
                | 'disabled'
                | 'invalid_host'
                | 'permission_denied'
                | 'timeout'
                | 'download_error'
                | 'other';
              status: 'failure';
              url: string;
            }
          | Record<string, unknown>
          | null;
      };
    }>;
  }>;
  has_debug_ids: boolean;
  has_scraping_data: boolean;
  has_uploaded_some_artifact_with_a_debug_id: boolean;
  min_debug_id_sdk_version: string | null;
  project_has_some_artifact_bundle: boolean;
  release: string | null;
  release_has_some_artifact: boolean;
  sdk_debug_id_support: 'not-supported' | 'unofficial-sdk' | 'needs-upgrade' | 'full';
  sdk_version: string | null;
};

export type StatusDetailsValidator = {
  ignoreCount: number;
  ignoreDuration: number;
  ignoreUserCount: number;
  ignoreUserWindow: number;
  ignoreWindow: number;
  inNextRelease: boolean;
  inRelease: string;
  inCommit?: InCommitValidator;
};

export type TagKeyDetailsDict = {
  key: string;
  name: string;
  topValues?: Array<{
    count: number | null;
    firstSeen: string | null;
    key: string;
    lastSeen: string | null;
    name: string;
    value: string | null;
    query?: string | null;
  }> | null;
  totalValues?: number | null;
  uniqueValues?: number | null;
};

export type TagKeyResponse = {
  key: string;
  name: string;
  topValues?: Array<{
    count: number | null;
    firstSeen: string | null;
    key: string;
    lastSeen: string | null;
    name: string;
    value: string | null;
    query?: string | null;
  }> | null;
  totalValues?: number | null;
  uniqueValues?: number | null;
};

export type TagKeyValuesDict = Array<{
  count: number | null;
  firstSeen: string | null;
  key: string;
  lastSeen: string | null;
  name: string;
  value: string | null;
  query?: string | null;
}>;

export type Team = {
  access: string[];
  avatar: {
    avatarType?: string;
    avatarUrl?: string | null;
    avatarUuid?: string | null;
  };
  dateCreated: string | null;
  flags: Record<string, unknown>;
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
  teamRole: string | null;
  externalTeams?: Array<{
    externalName: string;
    id: string;
    integrationId: string;
    provider: string;
    externalId?: string;
    teamId?: string;
    userId?: string;
  }>;
  organization?: {
    allowMemberInvite: boolean;
    allowMemberProjectCreation: boolean;
    allowSuperuserAccess: boolean;
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    dateCreated: string;
    hasAuthProvider: boolean;
    id: string;
    isEarlyAdopter: boolean;
    links: {
      organizationUrl: string;
      regionUrl: string;
    };
    name: string;
    require2FA: boolean;
    slug: string;
    status: {
      id: string;
      name: string;
    };
    access?: string[];
    extraOptions?: Record<string, Record<string, unknown>>;
    features?: string[];
    onboardingTasks?: Array<{
      completionSeen: string | null;
      data: unknown;
      dateCompleted: string;
      status: string;
      task: string | null;
    }>;
  };
  projects?: Array<{
    access: string[];
    avatar: {
      avatarType?: string;
      avatarUrl?: string | null;
      avatarUuid?: string | null;
    };
    color: string;
    dateCreated: string;
    features: string[];
    firstEvent: string | null;
    firstTransactionEvent: boolean;
    hasAccess: boolean;
    hasFeedbacks: boolean;
    hasFlags: boolean;
    hasInsightsAgentMonitoring: boolean;
    hasInsightsAppStart: boolean;
    hasInsightsAssets: boolean;
    hasInsightsCaches: boolean;
    hasInsightsDb: boolean;
    hasInsightsHttp: boolean;
    hasInsightsMCP: boolean;
    hasInsightsQueues: boolean;
    hasInsightsScreenLoad: boolean;
    hasInsightsVitals: boolean;
    hasLogs: boolean;
    hasMinifiedStackTrace: boolean;
    hasMonitors: boolean;
    hasNewFeedbacks: boolean;
    hasProfiles: boolean;
    hasReplays: boolean;
    hasSessions: boolean;
    hasTraceMetrics: boolean;
    id: string;
    isBookmarked: boolean;
    isInternal: boolean;
    isMember: boolean;
    isPublic: boolean;
    name: string;
    platform: string | null;
    slug: string;
    status: string;
    sessionStats?: unknown;
    stats?: unknown;
    transactionStats?: unknown;
  }>;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type TeamDetails = {
  slug: string;
  name?: string;
};

export type TeamPost = {
  name?: string | null;
  slug?: string | null;
};

export type TeamSCIM = {
  displayName: string;
  id: string;
  meta: {
    resourceType: string;
  };
  schemas: string[];
  members?: Array<{
    display: string;
    value: string;
  }>;
};

export type TimeSeriesValue = {
  count: number;
  date: string;
};

export type TraceItemStatsResponse = {
  data: Array<{
    attributeDistributions: {
      data: Record<
        string,
        Array<{
          label: string;
          value: number;
        }>
      >;
    };
  }>;
};

export type UpdateClientKey = {
  browserSdkVersion?: 'latest' | '7.x';
  dynamicSdkLoaderOptions?: DynamicSdkLoaderOption;
  isActive?: boolean;
  name?: string;
  rateLimit?: RateLimit;
};

export type UpdateGroupNote = {
  data: Record<string, unknown>;
  dateCreated: string;
  id: string;
  sentry_app: {
    avatars: Array<{
      avatarType: string;
      avatarUrl: string;
      avatarUuid: string;
      color: boolean;
      photoType: string;
    }>;
    id: string;
    name: string;
    slug: string;
  } | null;
  type: string;
  user: Record<string, unknown> | null;
};

export type UpdateOrgMemberRoles = {
  orgRole?: 'billing' | 'member' | 'manager' | 'owner' | 'admin';
  teamRoles?: Array<Record<string, unknown>> | null;
};

export type UpdateProjectReleaseResponse = {
  authors: Array<
    | {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      }
    | {
        email: string;
        name: string | null;
      }
  >;
  commitCount: number;
  data: Record<string, unknown>;
  deployCount: number;
  id: number;
  newGroups: number;
  projects: Array<{
    hasHealthData: boolean;
    id: number;
    name: string;
    newGroups: number;
    platform: string | null;
    platforms: string[] | null;
    slug: string;
    dateCreated?: string | null;
    dateReleased?: string | null;
    dateStarted?: string | null;
    healthData?: {
      hasHealthData: boolean;
      sessionsCrashed: number;
      sessionsErrored: number;
      stats: Record<string, unknown>;
      adoption?: number | null;
      crashFreeSessions?: number | null;
      crashFreeUsers?: number | null;
      durationP50?: number | null;
      durationP90?: number | null;
      sessionsAdoption?: number | null;
      totalProjectSessions24h?: number | null;
      totalProjectUsers24h?: number | null;
      totalSessions?: number | null;
      totalSessions24h?: number | null;
      totalUsers?: number | null;
      totalUsers24h?: number | null;
    } | null;
  }>;
  shortVersion: string;
  status: string;
  version: string;
  versionInfo: {
    buildHash: string | null;
    package: string | null;
    version: Record<string, unknown>;
    description?: string;
  } | null;
  adoptionStages?: Record<string, unknown> | null;
  currentProjectMeta?: Record<string, unknown> | null;
  dateCreated?: string | null;
  dateReleased?: string | null;
  dateStarted?: string | null;
  firstEvent?: string | null;
  lastCommit?: Record<string, unknown> | null;
  lastDeploy?: {
    dateFinished: string;
    environment: string;
    id: string;
    name: string;
    dateStarted?: string | null;
    url?: string | null;
  } | null;
  lastEvent?: string | null;
  owner?: Record<string, unknown> | null;
  ref?: string | null;
  url?: string | null;
  userAgent?: string | null;
};

export type UptimeAlertList = Array<{
  assertion: unknown;
  body: string | null;
  downtimeThreshold: number;
  environment: string | null;
  headers: Array<string[]>;
  id: string;
  intervalSeconds: number;
  method: string;
  mode: number;
  name: string;
  owner: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  };
  projectSlug: string;
  recoveryThreshold: number;
  responseCaptureEnabled: boolean;
  status: string;
  timeoutMs: number;
  traceSampling: boolean;
  uptimeStatus: number;
  url: string;
}>;

export type UptimeDetector = {
  assertion: unknown;
  body: string | null;
  downtimeThreshold: number;
  environment: string | null;
  headers: Array<string[]>;
  id: string;
  intervalSeconds: number;
  method: string;
  mode: number;
  name: string;
  owner: {
    id: string;
    name: string;
    type: 'user' | 'team';
    email?: string;
  };
  projectSlug: string;
  recoveryThreshold: number;
  responseCaptureEnabled: boolean;
  status: string;
  timeoutMs: number;
  traceSampling: boolean;
  uptimeStatus: number;
  url: string;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type UptimeMonitorValidator = {
  interval_seconds: 60 | 300 | 600 | 1200 | 1800 | 3600;
  name: string;
  timeout_ms: number;
  url: string;
  assertion?: Record<string, unknown> | null;
  body?: string | null;
  downtime_threshold?: number;
  environment?: string | null;
  headers?: Record<string, unknown>;
  method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  mode?: number;
  owner?: string | null;
  recovery_threshold?: number;
  response_capture_enabled?: boolean;
  status?: 'active' | 'disabled';
  trace_sampling?: boolean;
};

export type ValidateEventsQueryResponse = {
  dataset: Array<{
    error: string | null;
    name: string;
    valid: boolean;
  }>;
  environment: Array<{
    error: string | null;
    valid: boolean;
  }>;
  field: Array<{
    attrType: string | null;
    error: string | null;
    name: string;
    valid: boolean;
  }>;
  orderby: Array<{
    attrType: string | null;
    error: string | null;
    name: string;
    valid: boolean;
  }>;
  projects: Array<{
    error: string | null;
    valid: boolean;
  }>;
  query: {
    error: string | null;
    fields: Array<{
      attrType: string | null;
      error: string | null;
      name: string;
      valid: boolean;
    }>;
    valid: boolean;
  };
  valid: boolean;
};

export type Visualize = {
  yAxes: string[];
  chartType?: number;
};

/**
 * Widget grid layout position and dimensions.
 *
 * The dashboard uses a 6-column grid. Required keys: x, y, w, h, minH.
 * Constraints: x (0-5), y (>= 0), w (1-6), h (>= 1), minH (>= 1), and x + w <= 6.
 */
export type WidgetLayout = {
  h: number;
  min_h: number;
  w: number;
  x: number;
  y: number;
};

export type Workflow = {
  actionFilters: Array<{
    actions?:
      | Array<{
          config?: Record<string, unknown>;
          data?: Record<string, string>;
          id?: string;
          integrationId?: string | null;
          status?: string;
          type?: string;
        }>
      | unknown[];
    conditions?:
      | Array<{
          comparison: boolean | number;
          conditionResult: boolean;
          id: string;
          type: string;
        }>
      | unknown[];
    id?: string;
    logicType?: string;
    organizationId?: string;
  }> | null;
  config: Record<string, unknown>;
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  detectorIds: string[] | null;
  enabled: boolean;
  environment: string | null;
  id: string;
  lastTriggered: string | null;
  name: string;
  organizationId: string;
  owner: string | null;
  triggers: {
    actions?:
      | Array<{
          config?: Record<string, unknown>;
          data?: Record<string, string>;
          id?: string;
          integrationId?: string | null;
          status?: string;
          type?: string;
        }>
      | unknown[];
    conditions?:
      | Array<{
          comparison: boolean | number;
          conditionResult: boolean;
          id: string;
          type: string;
        }>
      | unknown[];
    id?: string;
    logicType?: string;
    organizationId?: string;
  } | null;
};

export type WorkflowGroupHistory = {
  count: number;
  eventId: string;
  group: {
    annotations: Array<{
      displayName: string;
      url: string;
    }>;
    assignedTo: {
      id: string;
      name: string;
      type: 'user' | 'team';
      email?: string;
    } | null;
    culprit: string | null;
    hasSeen: boolean;
    id: string;
    isBookmarked: boolean;
    isPublic: boolean;
    isSubscribed: boolean;
    issueCategory: string;
    issueType: string;
    level: 'sample' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
    logger: string | null;
    metadata: Record<string, unknown>;
    numComments: number;
    permalink: string;
    platform: string | null;
    priority: 'low' | 'medium' | 'high' | null;
    priorityLockedAt: string | null;
    project: {
      id: string;
      name: string;
      platform: string | null;
      slug: string;
    };
    seerAutofixLastTriggered: string | null;
    seerExplorerAutofixLastTriggered: string | null;
    seerFixabilityScore: number | null;
    shareId: string | null;
    shortId: string;
    status:
      | 'resolved'
      | 'ignored'
      | 'pending_deletion'
      | 'pending_merge'
      | 'reprocessing'
      | 'unresolved';
    statusDetails: {
      actor?: {
        avatarUrl: string;
        dateJoined: string;
        email: string;
        emails: Array<{
          email: string;
          id: string;
          is_verified: boolean;
        }>;
        experiments: Record<string, unknown>;
        has2fa: boolean;
        hasPasswordAuth: boolean;
        id: string;
        isActive: boolean;
        isManaged: boolean;
        isStaff: boolean;
        isSuperuser: boolean;
        isSuspended: boolean;
        lastActive: string | null;
        lastLogin: string | null;
        name: string;
        username: string;
        authenticators?: unknown[];
        avatar?: {
          avatarType?: string;
          avatarUrl?: string | null;
          avatarUuid?: string | null;
        };
        canReset2fa?: boolean;
        identities?: Array<{
          dateSynced: string;
          dateVerified: string;
          id: string;
          name: string;
          organization: {
            name: string;
            slug: string;
          };
          provider: {
            id: string;
            name: string;
          };
        }>;
      };
      ignoreCount?: number;
      ignoreUntil?: string;
      ignoreUserCount?: number;
      ignoreUserWindow?: number;
      ignoreWindow?: number;
      inCommit?: string;
      inNextRelease?: boolean;
      inRelease?: string;
      info?: {
        dateCreated: string;
        syncCount: number;
        totalEvents: number;
      } | null;
      pendingEvents?: number;
    };
    subscriptionDetails: {
      disabled?: boolean;
      reason?: string;
    } | null;
    substatus:
      | 'archived_until_escalating'
      | 'archived_until_condition_met'
      | 'archived_forever'
      | 'escalating'
      | 'ongoing'
      | 'regressed'
      | 'new'
      | null;
    title: string;
    type:
      | 'default'
      | 'error'
      | 'csp'
      | 'nel'
      | 'hpkp'
      | 'expectct'
      | 'expectstaple'
      | 'transaction'
      | 'generic'
      | 'feedback';
    count?: string;
    derivedData?: {
      blocker: string;
      hasOpenFixPr: boolean;
      hasRootCause: boolean;
      isAssigned: boolean;
      lastCompletedAutofixStep: string;
      lastProgressedAt: string | null;
      progress: string;
      status: string;
      viewCount: number;
    };
    firstSeen?: string | null;
    isUnhandled?: boolean;
    lastSeen?: string | null;
    userCount?: number;
  };
  lastTriggered: string;
  detector?: Record<string, unknown>;
};

/**
 * Allows parameters to be defined in snake case, but passed as camel case.
 *
 * Errors are output in camel case.
 */
export type WorkflowValidator = {
  name: string;
  action_filters?: ActionFilterValidator[];
  config?: Record<string, unknown>;
  detector_ids?: number[];
  enabled?: boolean;
  environment?: string | null;
  id?: string;
  owner?: string | null;
  triggers?: BaseDataConditionGroupValidator;
};

export type _LegacyBrowserFilter = {
  active?: boolean;
  subfilters?: Array<
    | 'ie'
    | 'edge'
    | 'safari'
    | 'firefox'
    | 'chrome'
    | 'opera'
    | 'android'
    | 'opera_mini'
    | 'ie_pre_9'
    | 'ie9'
    | 'ie10'
    | 'ie11'
    | 'opera_pre_15'
    | 'android_pre_4'
    | 'safari_pre_6'
    | 'opera_mini_pre_8'
    | 'edge_pre_79'
  >;
};

export type ApiMapping = {
  '/auth-v2/csrf/': {
    /** Retrieve the CSRF token in your session (experimental) */
    GET: {response: CsrfTokenResponse};
    /** Rotate the CSRF token in your session (experimental) */
    PUT: {response: CsrfTokenResponse};
  };
  '/auth/2fa/': {
    /** Get available methods for a pending two-factor authentication login (private) */
    GET: {response: AuthMfaRequired};
    /** Complete a pending two-factor authentication login (private) */
    POST: {response: AuthSuccess};
  };
  '/auth/2fa/challenge/': {
    /** Activate a two-factor authentication challenge (private) */
    POST: {response: AuthMfaChallenge};
  };
  '/auth/login/': {
    /** Log in with a username and password (private) */
    POST: {response: AuthSuccess | AuthMfaRequired};
  };
  '/auth/organizations/$organizationIdOrSlug/config/': {
    /** Retrieve organization login configuration (private) */
    GET: {response: AuthOrganizationConfig};
  };
  '/auth/recovery/': {
    /** Request account password recovery (private) */
    POST: {response: AuthRecoveryAccepted};
  };
  '/organizations/': {
    /** listOrganizations (public) */
    GET: {response: ListOrganizations};
  };
  '/organizations/$organizationIdOrSlug/': {
    /** getOrganization (public) */
    GET: {response: OrganizationSummary};
    /** updateOrganization (public) */
    PUT: {response: OrganizationWithProjectsAndTeams};
  };
  '/organizations/$organizationIdOrSlug/agent/approve/': {
    /** Approve Seer agent write scopes (private) */
    POST: {response: AgentApprovalResponse};
  };
  '/organizations/$organizationIdOrSlug/agent/token/': {
    /** Mint a Seer agent capability token (private) */
    POST: {response: AgentTokenResponse};
  };
  '/organizations/$organizationIdOrSlug/agents/conversations/': {
    /** listOrganizationAIConversations (public) */
    GET: {response: ListOrganizationAIConversationsResponse};
  };
  '/organizations/$organizationIdOrSlug/agents/conversations/$conversationId/': {
    /** retrieveOrganizationAIConversation (public) */
    GET: {response: RetrieveOrganizationAIConversationResponse};
  };
  '/organizations/$organizationIdOrSlug/alert-rule-detector/': {
    /** Fetch Dual-Written Rule/Alert Rules and Detectors (experimental) */
    GET: {response: AlertRuleDetector};
  };
  '/organizations/$organizationIdOrSlug/alert-rule-workflow/': {
    /** Fetch Dual-Written Rule/Alert Rules and Workflows (experimental) */
    GET: {response: AlertRuleWorkflow};
  };
  '/organizations/$organizationIdOrSlug/alert-rules/': {
    /** (DEPRECATED) List an Organization's Metric Alert Rules (private) */
    GET: {response: ListMetricAlertRuleResponse};
    /** (DEPRECATED) Create a Metric Alert Rule for an Organization (private) */
    POST: {response: MetricAlertRuleResponse | MetricAlertRuleAsyncResponse};
  };
  '/organizations/$organizationIdOrSlug/available-actions/': {
    /** Fetch Available Actions (experimental) */
    GET: {response: ListAvailableActionResponse};
  };
  '/organizations/$organizationIdOrSlug/config/integrations/': {
    /** getOrganizationConfigIntegrations (public) */
    GET: {response: OrganizationConfigIntegrationsEndpointResponse};
  };
  '/organizations/$organizationIdOrSlug/dashboards/': {
    /** listOrganizationDashboards (public) */
    GET: {response: DashboardListResponse};
    /** createOrganizationDashboard (public) */
    POST: {response: DashboardDetailsModel};
  };
  '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/': {
    /** getOrganizationDashboard (public) */
    GET: {response: DashboardDetailsModel};
    /** updateOrganizationDashboard (public) */
    PUT: {response: DashboardDetailsModel};
  };
  '/organizations/$organizationIdOrSlug/data-conditions/': {
    /** Fetch Data Conditions (experimental) */
    GET: {response: ListDataConditionHandlerResponse};
  };
  '/organizations/$organizationIdOrSlug/detector-types/': {
    /** Fetch Detector Types (experimental) */
    GET: {response: ListDetectorTypes};
  };
  '/organizations/$organizationIdOrSlug/detectors/': {
    /** listOrganizationDetectors (public) */
    GET: {response: ListDetectorSerializerResponse};
    /** updateOrganizationDetectors (public) */
    PUT: {response: ListDetectorSerializerResponse};
  };
  '/organizations/$organizationIdOrSlug/detectors/$detectorId/': {
    /** getOrganizationDetector (public) */
    GET: {response: Detector};
    /** updateOrganizationDetector (public) */
    PUT: {response: Detector};
  };
  '/organizations/$organizationIdOrSlug/detectors/$detectorId/anomaly-data/': {
    /** Retrieve Anomaly Detection Threshold Data for a Detector (private) */
    GET: {response: Record<string, unknown>};
  };
  '/organizations/$organizationIdOrSlug/detectors/count/': {
    /** Get Organization Detector Count (experimental) */
    GET: {response: DetectorCountResponse};
  };
  '/organizations/$organizationIdOrSlug/discover/saved/': {
    /** listOrganizationDiscoverSavedQueries (public) */
    GET: {response: DiscoverSavedQueryListResponse};
    /** createOrganizationDiscoverSavedQuery (public) */
    POST: {response: DiscoverSavedQueryModel};
  };
  '/organizations/$organizationIdOrSlug/discover/saved/$queryId/': {
    /** getOrganizationDiscoverSavedQuery (public) */
    GET: {response: DiscoverSavedQueryModel};
    /** updateOrganizationDiscoverSavedQuery (public) */
    PUT: {response: DiscoverSavedQueryModel};
  };
  '/organizations/$organizationIdOrSlug/environments/': {
    /** listOrganizationEnvironments (public) */
    GET: {response: OrganizationEnvironmentResponse};
  };
  '/organizations/$organizationIdOrSlug/eventids/$eventId/': {
    /** resolveOrganizationEventId (public) */
    GET: {response: EventIdLookupResponse};
  };
  '/organizations/$organizationIdOrSlug/events-facets/': {
    /** organizations_events_facets_retrieve (private) */
    GET: {response: OrganizationEventsFacetsResponse};
  };
  '/organizations/$organizationIdOrSlug/events-meta/': {
    /** organizations_events_meta_retrieve (private) */
    GET: {response: OrganizationEventsMetaResponse};
  };
  '/organizations/$organizationIdOrSlug/events-stats/': {
    /** organizations_events_stats_retrieve (experimental) */
    GET: {response: OrganizationEventsStatsResponse};
  };
  '/organizations/$organizationIdOrSlug/events-timeseries/': {
    /** listOrganizationEventsTimeseries (public) */
    GET: {response: OrganizationEventsTimeseriesResponse};
  };
  '/organizations/$organizationIdOrSlug/events/': {
    /** listOrganizationEvents (public) */
    GET: {response: OrganizationEventsResponseDict};
  };
  '/organizations/$organizationIdOrSlug/events/validate/': {
    /** validateOrganizationEventsQuery (experimental) */
    GET: {response: ValidateEventsQueryResponse};
  };
  '/organizations/$organizationIdOrSlug/explore/saved/': {
    /** List an Organization's Explore Saved Queries (experimental) */
    GET: {response: ExploreSavedQueryListResponse};
    /** Create a New Trace Explorer Saved Query (experimental) */
    POST: {response: ExploreSavedQueryModel};
  };
  '/organizations/$organizationIdOrSlug/explore/saved/$id/': {
    /** Retrieve an Organization's Explore Saved Query (experimental) */
    GET: {response: ExploreSavedQueryModel};
    /** Edit an Organization's Explore Saved Query (experimental) */
    PUT: {response: ExploreSavedQueryModel};
  };
  '/organizations/$organizationIdOrSlug/external-users/': {
    /** createOrganizationExternalUser (public) */
    POST: {response: ExternalActor};
  };
  '/organizations/$organizationIdOrSlug/external-users/$externalUserId/': {
    /** updateOrganizationExternalUser (public) */
    PUT: {response: ExternalActor};
  };
  '/organizations/$organizationIdOrSlug/forwarding/': {
    /** listOrganizationForwarding (public) */
    GET: {response: ListDataForwarderResponse};
    /** createOrganizationForwarding (public) */
    POST: {response: DataForwarderResponse};
  };
  '/organizations/$organizationIdOrSlug/forwarding/$dataForwarderId/': {
    /** updateOrganizationForwarding (public) */
    PUT: {response: DataForwarderResponse};
  };
  '/organizations/$organizationIdOrSlug/group-search-views/': {
    /** listOrganizationIssueViews (public) */
    GET: {response: OrganizationIssueViewList};
    /** createOrganizationIssueView (public) */
    POST: {response: OrganizationIssueView};
  };
  '/organizations/$organizationIdOrSlug/incident-groupopenperiod/': {
    /** Fetch Incident and Group Open Period Relationship (experimental) */
    GET: {response: IncidentGroupOpenPeriod};
  };
  '/organizations/$organizationIdOrSlug/integrations/': {
    /** listOrganizationIntegrations (public) */
    GET: {response: ListOrganizationIntegrationResponse};
  };
  '/organizations/$organizationIdOrSlug/integrations/$integrationId/': {
    /** getOrganizationIntegration (public) */
    GET: {response: OrganizationIntegrationResponse};
  };
  '/organizations/$organizationIdOrSlug/integrations/$integrationId/serverless-functions/': {
    /** List an Integration's Serverless Functions (private) */
    GET: {response: ListServerlessFunctions};
    /** Update an Integration's Serverless Function (private) */
    POST: {response: ServerlessFunction};
  };
  '/organizations/$organizationIdOrSlug/invite-requests/': {
    /** List an Organization's Invite Requests (private) */
    GET: {response: ListInviteRequests};
    /** Create an Invite Request (private) */
    POST: {response: InviteRequest};
  };
  '/organizations/$organizationIdOrSlug/issues/': {
    /** listOrganizationIssues (public) */
    GET: {response: OrganizationGroupIndexGetResponse};
    /** updateOrganizationIssues (public) */
    PUT: {response: OrganizationGroupIndexPutResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/': {
    /** getOrganizationIssue (public) */
    GET: {response: GroupDetailsResponse};
    /** updateOrganizationIssue (public) */
    PUT: {response: GroupUpdateResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/': {
    /** getOrganizationIssueAutofixState (public) */
    GET: {response: AutofixStateResponse};
    /** startOrganizationIssueAutofix (public) */
    POST: {response: AutofixPostResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/events/': {
    /** listOrganizationIssueEvents (public) */
    GET: {response: GroupEventsResponseDict};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/': {
    /** getOrganizationIssueEvent (public) */
    GET: {response: IssueEventDetailsResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/external-issues/': {
    /** listOrganizationIssueExternalIssues (public) */
    GET: {response: GroupExternalIssueResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/hashes/': {
    /** listOrganizationIssueHashes (public) */
    GET: {response: GroupHashesResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/integrations/$integrationId/': {
    /** Retrieve an Integration's Issue Config for an Issue (public) */
    GET: {response: IntegrationIssueConfigResponse};
    /** Create an External Issue and Link It to an Issue (public) */
    POST: {response: ExternalIssueLinkResponse};
    /** Link an Existing External Issue to an Issue (public) */
    PUT: {response: ExternalIssueLinkResponse};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/tags/$key/': {
    /** getOrganizationIssueTag (public) */
    GET: {response: TagKeyDetailsDict};
  };
  '/organizations/$organizationIdOrSlug/issues/$issueId/tags/$key/values/': {
    /** listOrganizationIssueTagValues (public) */
    GET: {response: TagKeyValuesDict};
  };
  '/organizations/$organizationIdOrSlug/members/': {
    /** listOrganizationMembers (public) */
    GET: {response: ListOrganizationMemberResponse};
    /** addOrganizationMember (public) */
    POST: {response: OrganizationMember};
  };
  '/organizations/$organizationIdOrSlug/members/$memberId/': {
    /** getOrganizationMember (public) */
    GET: {response: OrganizationMemberWithRoles};
    /** updateOrganizationMember (public) */
    PUT: {response: OrganizationMemberWithRoles};
  };
  '/organizations/$organizationIdOrSlug/members/$memberId/teams/$teamIdOrSlug/': {
    /** deleteOrganizationMemberTeam (public) */
    DELETE: {response: BaseTeam};
    /** addOrganizationMemberTeam (public) */
    POST: {response: BaseTeam};
    /** updateOrganizationMemberTeam (public) */
    PUT: {response: OrganizationMemberTeamDetails};
  };
  '/organizations/$organizationIdOrSlug/monitors/': {
    /** listOrganizationMonitors (public) */
    GET: {response: MonitorList};
    /** createOrganizationMonitor (public) */
    POST: {response: Monitor};
    /** Bulk Edit Monitors (experimental) */
    PUT: {response: MonitorBulkEditResponse};
  };
  '/organizations/$organizationIdOrSlug/monitors/$monitorIdOrSlug/': {
    /** getOrganizationMonitor (public) */
    GET: {response: Monitor};
    /** updateOrganizationMonitor (public) */
    PUT: {response: Monitor};
  };
  '/organizations/$organizationIdOrSlug/monitors/$monitorIdOrSlug/checkins/': {
    /** listOrganizationMonitorCheckins (public) */
    GET: {response: CheckInList};
  };
  '/organizations/$organizationIdOrSlug/monitors/$monitorIdOrSlug/environments/$environment/': {
    /** Update a Monitor Environment (experimental) */
    PUT: {response: Monitor};
  };
  '/organizations/$organizationIdOrSlug/notifications/actions/': {
    /** listOrganizationNotificationsActions (public) */
    GET: {response: OutgoingNotificationAction};
    /** createOrganizationNotificationsAction (public) */
    POST: {response: OutgoingNotificationAction};
  };
  '/organizations/$organizationIdOrSlug/notifications/actions/$actionId/': {
    /** getOrganizationNotificationsAction (public) */
    GET: {response: OutgoingNotificationAction};
    /** updateOrganizationNotificationsAction (public) */
    PUT: {response: OutgoingNotificationAction};
  };
  '/organizations/$organizationIdOrSlug/onboarding/agent/runs/': {
    /** organizations_onboarding_agent_runs_create (private) */
    POST: {response: AgenticOnboardingRun};
  };
  '/organizations/$organizationIdOrSlug/onboarding/agent/runs/$runId/': {
    /** organizations_onboarding_agent_runs_destroy (private) */
    DELETE: {response: AgenticOnboardingRun};
    /** organizations_onboarding_agent_runs_retrieve (private) */
    GET: {response: AgenticOnboardingRun};
  };
  '/organizations/$organizationIdOrSlug/onboarding/agent/status/': {
    /** organizations_onboarding_agent_status_create (private) */
    POST: {response: AgenticOnboardingRun};
  };
  '/organizations/$organizationIdOrSlug/open-periods/': {
    /** Fetch Group Open Periods (private) */
    GET: {response: GroupOpenPeriod};
  };
  '/organizations/$organizationIdOrSlug/preprodartifacts/$artifactId/install-details/': {
    /** getOrganizationPreprodArtifactInstallDetails (public) */
    GET: {response: InstallInfoResponse};
  };
  '/organizations/$organizationIdOrSlug/preprodartifacts/$artifactId/size-analysis/': {
    /** getOrganizationPreprodArtifactSizeAnalysis (public) */
    GET: {response: SizeAnalysisResponse};
  };
  '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/': {
    /** getOrganizationPreprodArtifactSnapshot (public) */
    GET: {response: SnapshotDetailsResponse};
  };
  '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/images/$imageIdentifier/': {
    /** getOrganizationPreprodArtifactSnapshotImage (public) */
    GET: {response: SnapshotImageDetailResponse};
  };
  '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/latest-base/': {
    /** getOrganizationPreprodArtifactSnapshotLatestBase (public) */
    GET: {response: LatestBaseSnapshotResponse};
  };
  '/organizations/$organizationIdOrSlug/processing-errors/': {
    /** Retrieve checkin processing errors for an Organization (private) */
    GET: {response: CheckinProcessingError};
  };
  '/organizations/$organizationIdOrSlug/profiling/chunk-attachments/': {
    /** listOrganizationProfilingChunkAttachments (private) */
    GET: {response: OrganizationProfilingChunkAttachmentsResponse};
  };
  '/organizations/$organizationIdOrSlug/profiling/chunks/': {
    /** listOrganizationProfilingChunks (public) */
    GET: {response: OrganizationProfilingChunksResponse};
  };
  '/organizations/$organizationIdOrSlug/profiling/flamegraph/': {
    /** getOrganizationProfilingFlamegraph (public) */
    GET: {response: OrganizationProfilingFlamegraphResponse};
  };
  '/organizations/$organizationIdOrSlug/project-keys/': {
    /** listOrganizationProjectKeys (public) */
    GET: {response: ListOrganizationClientKeysResponse};
  };
  '/organizations/$organizationIdOrSlug/projects/': {
    /** listOrganizationProjects (public) */
    GET: {response: OrganizationProjectResponseDict};
    /** createOrganizationProject (public) */
    POST: {response: ProjectSummary};
  };
  '/organizations/$organizationIdOrSlug/projects/$projectIdOrSlug/detectors/': {
    /** createOrganizationProjectDetector (public) */
    POST: {response: Detector};
  };
  '/organizations/$organizationIdOrSlug/prompts-activity/': {
    /** Retrieve Prompt Statuses (private) */
    GET: {response: PromptsActivityResponse};
  };
  '/organizations/$organizationIdOrSlug/relay_usage/': {
    /** listOrganizationRelayUsage (public) */
    GET: {response: OrganizationRelayResponse};
  };
  '/organizations/$organizationIdOrSlug/release-threshold-statuses/': {
    /** listOrganizationReleaseThresholdStatuses (public) */
    GET: {response: ReleaseThresholdStatusResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/': {
    /** listOrganizationReleases (public) */
    GET: {response: ListOrganizationReleasesResponse};
    /** createOrganizationRelease (public) */
    POST: {response: CreateOrganizationReleaseResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/$version/': {
    /** getOrganizationRelease (public) */
    GET: {response: OrgReleaseResponse};
    /** updateOrganizationRelease (public) */
    PUT: {response: OrgReleaseResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/$version/assemble/': {
    /** Assemble a Release Artifact Bundle (private) */
    POST: {response: ReleaseAssembleResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/$version/commits/': {
    /** listOrganizationReleaseCommits (public) */
    GET: {response: ListOrganizationReleaseCommitsResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/$version/deploys/': {
    /** listOrganizationReleaseDeploys (public) */
    GET: {response: DeployResponse[]};
    /** createOrganizationReleaseDeploy (public) */
    POST: {response: DeployResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/$version/files/': {
    /** listOrganizationReleaseFiles (public) */
    GET: {response: ListReleaseFiles};
    /** uploadOrganizationReleaseFile (public) */
    POST: {response: ReleaseFileResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/$version/files/$fileId/': {
    /** getOrganizationReleaseFile (public) */
    GET: {response: ReleaseFileResponse};
    /** updateOrganizationReleaseFile (public) */
    PUT: {response: ReleaseFileResponse};
  };
  '/organizations/$organizationIdOrSlug/releases/stats/': {
    /** List an Organization's Release Timeseries Data (private) */
    GET: {response: OrganizationReleaseTimeseriesResponse};
  };
  '/organizations/$organizationIdOrSlug/replay-count/': {
    /** getOrganizationReplayCount (public) */
    GET: {response: ReplayCounts};
  };
  '/organizations/$organizationIdOrSlug/replay-selectors/': {
    /** listOrganizationReplaySelectors (public) */
    GET: {response: ListSelectors};
  };
  '/organizations/$organizationIdOrSlug/replays/': {
    /** listOrganizationReplays (public) */
    GET: {response: ListReplays};
  };
  '/organizations/$organizationIdOrSlug/replays/$replayId/': {
    /** getOrganizationReplay (public) */
    GET: {response: GetReplay};
  };
  '/organizations/$organizationIdOrSlug/repos/': {
    /** listOrganizationRepos (public) */
    GET: {response: ListOrganizationRepositoriesResponse};
  };
  '/organizations/$organizationIdOrSlug/repos/$repoId/commits/': {
    /** listOrganizationRepoCommits (public) */
    GET: {response: CommitSerializerResponse};
  };
  '/organizations/$organizationIdOrSlug/sampling/effective-sample-rate/': {
    /** Retrieve an Organization's Effective Sample Rate (24h) (private) */
    GET: {response: OrganizationSamplingEffectiveSampleRateResponse};
  };
  '/organizations/$organizationIdOrSlug/scim/v2/Groups': {
    /** listOrganizationScimV2Groups (public) */
    GET: {response: SCIMListResponseEnvelopeSCIMTeamIndexResponse};
    /** provisionOrganizationScimV2Group (public) */
    POST: {response: TeamSCIM};
  };
  '/organizations/$organizationIdOrSlug/scim/v2/Groups/$teamIdOrSlug': {
    /** getOrganizationScimV2Group (public) */
    GET: {response: TeamSCIM};
  };
  '/organizations/$organizationIdOrSlug/scim/v2/Users': {
    /** listOrganizationScimV2Users (public) */
    GET: {response: SCIMListResponseEnvelopeSCIMMemberIndexResponse};
    /** provisionOrganizationScimV2User (public) */
    POST: {response: OrganizationMemberSCIM};
  };
  '/organizations/$organizationIdOrSlug/scim/v2/Users/$memberId': {
    /** getOrganizationScimV2User (public) */
    GET: {response: OrganizationMemberSCIM};
    /** replaceOrganizationScimV2User (experimental) */
    PUT: {response: OrganizationMemberSCIM};
  };
  '/organizations/$organizationIdOrSlug/sentry-app-installations/': {
    /** List an Organization's Integration Platform Installations (private) */
    GET: {
      response: Array<{
        app: {
          sentryAppId: number;
          slug: string;
          uuid: string;
        };
        organization: {
          slug: string;
        };
        status: string;
        uuid: string;
      }>;
    };
  };
  '/organizations/$organizationIdOrSlug/sentry-apps/': {
    /** listOrganizationSentryApps (public) */
    GET: {response: OrganizationSentryAppDetailsResponse};
  };
  '/organizations/$organizationIdOrSlug/sessions/': {
    /** getOrganizationSessions (public) */
    GET: {response: SessionsQueryResult};
  };
  '/organizations/$organizationIdOrSlug/shortids/$issueId/': {
    /** resolveOrganizationShortId (public) */
    GET: {response: ShortIdLookupResponse};
  };
  '/organizations/$organizationIdOrSlug/stats-summary/': {
    /** getOrganizationStatsSummary (public) */
    GET: {response: OrganizationStatsSummaryResponse};
  };
  '/organizations/$organizationIdOrSlug/stats_v2/': {
    /** listOrganizationStatsV2 (public) */
    GET: {response: OutcomesResponse};
  };
  '/organizations/$organizationIdOrSlug/tags/': {
    /** listOrganizationTags (public) */
    GET: {response: ListOrganizationTagsResponse};
  };
  '/organizations/$organizationIdOrSlug/tags/$key/values/': {
    /** listOrganizationTagValues (private) */
    GET: {response: ListOrganizationTagValuesResponse};
  };
  '/organizations/$organizationIdOrSlug/teams/': {
    /** listOrganizationTeams (public) */
    GET: {response: ListOrgTeamResponse};
    /** createOrganizationTeam (public) */
    POST: {response: Team};
  };
  '/organizations/$organizationIdOrSlug/trace-items/attributes/': {
    /** listOrganizationTraceItemAttributes (public) */
    GET: {response: ListTraceItemAttributesResponse};
  };
  '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/values/': {
    /** listOrganizationTraceItemAttributeValues (private) */
    GET: {response: ListTraceItemAttributeValuesResponse};
  };
  '/organizations/$organizationIdOrSlug/trace-items/metrics/': {
    /** listOrganizationTraceMetrics (experimental) */
    GET: {response: ListOrganizationTraceMetricsResponse};
  };
  '/organizations/$organizationIdOrSlug/trace-items/stats/': {
    /** Retrieve Trace Item Statistics (public) */
    GET: {response: TraceItemStatsResponse};
  };
  '/organizations/$organizationIdOrSlug/trace-meta/$traceId/': {
    /** getOrganizationTraceMeta (public) */
    GET: {response: OrganizationTraceMetaResponse};
  };
  '/organizations/$organizationIdOrSlug/trace/$traceId/': {
    /** getOrganizationTrace (public) */
    GET: {response: OrganizationTraceResponse};
  };
  '/organizations/$organizationIdOrSlug/traces/': {
    /** listOrganizationTraces (experimental) */
    GET: {response: ListTracesResponse};
  };
  '/organizations/$organizationIdOrSlug/uptime/': {
    /** Retrieve Uptime Alets for an Organization (experimental) */
    GET: {response: UptimeAlertList};
  };
  '/organizations/$organizationIdOrSlug/user-teams/': {
    /** listOrganizationUserTeams (public) */
    GET: {response: ListOrgTeamResponse};
  };
  '/organizations/$organizationIdOrSlug/workflows/': {
    /** listOrganizationWorkflows (public) */
    GET: {response: ListWorkflow};
    /** createOrganizationWorkflow (public) */
    POST: {response: Workflow};
    /** updateOrganizationWorkflows (public) */
    PUT: {response: ListWorkflow};
  };
  '/organizations/$organizationIdOrSlug/workflows/$workflowId/': {
    /** getOrganizationWorkflow (public) */
    GET: {response: Workflow};
    /** updateOrganizationWorkflow (public) */
    PUT: {response: Workflow};
  };
  '/organizations/$organizationIdOrSlug/workflows/$workflowId/group-history/': {
    /** Retrieve Group Firing History for a Workflow (experimental) */
    GET: {response: WorkflowGroupHistory};
  };
  '/organizations/$organizationIdOrSlug/workflows/$workflowId/stats/': {
    /** Retrieve Firing Stats for a Workflow for a Given Time Range. (experimental) */
    GET: {response: TimeSeriesValue};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/': {
    /** getProject (public) */
    GET: {response: DetailedProject};
    /** updateProject (public) */
    PUT: {response: DetailedProject};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/': {
    /** List a Project's Custom Inbound Filters (experimental) */
    GET: {response: CustomInboundFilter[]};
    /** Create a Custom Inbound Filter (experimental) */
    POST: {response: CustomInboundFilter};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/$filterId/': {
    /** Retrieve a Custom Inbound Filter (experimental) */
    GET: {response: CustomInboundFilter};
    /** Update a Custom Inbound Filter (experimental) */
    PUT: {response: CustomInboundFilter};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/': {
    /** listProjectEnvironments (public) */
    GET: {response: ListProjectEnvironments};
    /** Bulk Update Project Environments (public) */
    PUT: {response: BulkUpdateProjectEnvironments};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/$environment/': {
    /** getProjectEnvironment (public) */
    GET: {response: EnvironmentProject};
    /** updateProjectEnvironment (public) */
    PUT: {response: EnvironmentProject};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/': {
    /** listProjectEvents (public) */
    GET: {response: ProjectEventsResponseDict};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/': {
    /** getProjectEvent (public) */
    GET: {response: ProjectEventDetailsResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/': {
    /** listProjectEventAttachments (public) */
    GET: {response: ListEventAttachmentsResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/$attachmentId/': {
    /** getProjectEventAttachment (public) */
    GET: {response: EventAttachmentDetailsResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/source-map-debug/': {
    /** getProjectEventSourceMapDebug (public) */
    GET: {response: SourceMapDebug};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/': {
    /** listProjectDebugFiles (public) */
    GET: {response: ListProjectDebugFilesResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/filters/': {
    /** listProjectFilters (public) */
    GET: {response: ProjectFilterResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/hooks/': {
    /** List a Project's Service Hooks (private) */
    GET: {
      response: Array<{
        dateCreated: string;
        events: string[];
        id: string;
        secret: string;
        status: string;
        url: string;
      }>;
    };
    /** Register a New Service Hook (private) */
    POST: {
      response: {
        dateCreated: string;
        events: string[];
        id: string;
        secret: string;
        status: string;
        url: string;
      };
    };
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/hooks/$hookId/': {
    /** Retrieve a Service Hook (public) */
    GET: {
      response: {
        dateCreated: string;
        events: string[];
        id: string;
        secret: string;
        status: string;
        url: string;
      };
    };
    /** Update a Service Hook (public) */
    PUT: {
      response: {
        dateCreated: string;
        events: string[];
        id: string;
        secret: string;
        status: string;
        url: string;
      };
    };
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/hooks/$hookId/stats/': {
    /** Retrieve a Service Hook's Stats (private) */
    GET: {response: ListServiceHookStats};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/': {
    /** List a Project's Issues (public) */
    GET: {
      response: Array<{
        annotations: string[];
        assignedTo: Record<string, unknown> | null;
        count: string;
        culprit: string;
        firstSeen: string;
        hasSeen: boolean;
        id: string;
        isBookmarked: boolean;
        isPublic: boolean;
        isSubscribed: boolean;
        lastSeen: string;
        level: string;
        logger: string | null;
        metadata:
          | {
              filename: string;
              type: string;
              value: string;
            }
          | {
              title: string;
            };
        numComments: number;
        permalink: string;
        project: {
          id?: string;
          name?: string;
          slug?: string;
        };
        shareId: string | null;
        shortId: string;
        stats: {
          '24h'?: Array<number[]>;
        };
        status: 'resolved' | 'unresolved' | 'ignored';
        statusDetails: Record<string, unknown>;
        subscriptionDetails: Record<string, unknown> | null;
        title: string;
        type: string;
        userCount: number;
      }>;
    };
    /** Bulk Mutate a List of Issues (public) */
    PUT: {
      response: {
        isPublic: boolean;
        status: 'resolved' | 'unresolved' | 'ignored';
        statusDetails: Record<string, unknown>;
      };
    };
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/': {
    /** listProjectKeys (public) */
    GET: {response: ListClientKeysResponse};
    /** createProjectKey (public) */
    POST: {response: ProjectKey};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/$keyId/': {
    /** getProjectKey (public) */
    GET: {response: ProjectKey};
    /** updateProjectKey (public) */
    PUT: {response: ProjectKey};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/members/': {
    /** listProjectMembers (public) */
    GET: {response: ListOrgMembersResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/': {
    /** getProjectMonitor (public) */
    GET: {response: Monitor};
    /** updateProjectMonitor (public) */
    PUT: {response: Monitor};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/checkins/': {
    /** listProjectMonitorCheckins (public) */
    GET: {response: CheckInList};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/environments/$environment/': {
    /** Update a Monitor Environment for a Project (experimental) */
    PUT: {response: Monitor};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/processing-errors/': {
    /** Retrieve checkin processing errors for a monitor (private) */
    GET: {response: CheckinProcessingError};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/overview/': {
    /** Retrieve a Project overview (experimental) */
    GET: {response: Project};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/ownership/': {
    /** getProjectOwnership (public) */
    GET: {response: ProjectOwnership};
    /** updateProjectOwnership (public) */
    PUT: {response: ProjectOwnership};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprod/size-analysis/status-check-rules/': {
    /** getProjectPreprodSizeAnalysisStatusCheckRules (public) */
    GET: {response: ProjectSizeStatusCheckRulesResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprod/snapshots/status-check-rules/': {
    /** getProjectPreprodSnapshotStatusCheckRules (public) */
    GET: {response: ProjectSnapshotStatusCheckRulesResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/build-distribution/latest/': {
    /** getProjectInstallableBuildLatest (public) */
    GET: {response: LatestInstallableBuildResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/snapshots/': {
    /** uploadProjectPreprodArtifactSnapshot (public) */
    POST: {response: SnapshotCreateResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/profiling/profiles/$profileId/': {
    /** getProjectProfilingProfile (public) */
    GET: {response: ProjectProfilingProfileResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/': {
    /** listProjectReleases (public) */
    GET: {response: ListProjectReleasesResponse};
    /** Create a New Release for a Project (private) */
    POST: {response: CreateProjectReleaseResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/': {
    /** Retrieve a Project's Release (private) */
    GET: {response: ProjectReleaseResponse};
    /** Update a Project's Release (private) */
    PUT: {response: UpdateProjectReleaseResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/commits/': {
    /** listProjectReleaseCommits (public) */
    GET: {response: ListProjectReleaseCommitsResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/files/': {
    /** listProjectReleaseFiles (public) */
    GET: {response: ListReleaseFiles};
    /** uploadProjectReleaseFile (public) */
    POST: {response: ReleaseFileResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/files/$fileId/': {
    /** getProjectReleaseFile (public) */
    GET: {response: ReleaseFileResponse};
    /** updateProjectReleaseFile (public) */
    PUT: {response: ReleaseFileResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/repositories/': {
    /** Retrieve a Project Release's Repositories (private) */
    GET: {response: ListProjectReleaseRepositoriesResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/stats/': {
    /** Retrieve a Project Release's Health Stats (private) */
    GET: {response: ProjectReleaseStats};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/completion/': {
    /** Retrieve a Project's Release Setup Progress (private) */
    GET: {response: ListReleaseSetupSteps};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/clicks/': {
    /** listProjectReplayClicks (public) */
    GET: {response: ListReplayClicks};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/recording-segments/': {
    /** listProjectReplayRecordingSegments (public) */
    GET: {response: ListReplayRecordingSegments};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/recording-segments/$segmentId/': {
    /** getProjectReplayRecordingSegment (public) */
    GET: {response: GetReplayRecordingSegment};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/videos/$segmentId/': {
    /** Fetch Replay Video (experimental) */
    GET: {response: GetReplayVideo};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/': {
    /** listProjectReplayViewedBy (public) */
    GET: {response: GetReplayViewedBy};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/jobs/delete/': {
    /** listProjectReplayDeletionJobs (public) */
    GET: {response: ListReplayDeletionJobs};
    /** createProjectReplayDeletionJob (public) */
    POST: {response: CreateReplayDeletionJob};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/jobs/delete/$jobId/': {
    /** getProjectReplayDeletionJob (public) */
    GET: {response: GetReplayDeletionJob};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/repo-path-parsing/': {
    /** Parse a Repository Path Mapping (private) */
    POST: {response: RepoPathParsing};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/': {
    /** linkProjectRepository (public) */
    POST: {response: ProjectRepoLinkResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/': {
    /** (DEPRECATED) List a Project's Issue Alert Rules (private) */
    GET: {response: ListRules};
    /** (DEPRECATED) Create an Issue Alert Rule for a Project (private) */
    POST: {response: Rule};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/': {
    /** (DEPRECATED) Retrieve an Issue Alert Rule for a Project (private) */
    GET: {response: Rule};
    /** (DEPRECATED) Update an Issue Alert Rule (private) */
    PUT: {response: Rule};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/group-history/': {
    /** Retrieve a Group Firing History for an Issue Alert (experimental) */
    GET: {response: RuleGroupHistory};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/stats/': {
    /** Retrieve Firing Starts for an Issue Alert Rule for a Given Time Range. (experimental) */
    GET: {response: TimeSeriesValue};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/stats/': {
    /** listProjectStats (public) */
    GET: {response: ProjectStats};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/symbol-sources/': {
    /** listProjectSymbolSources (public) */
    GET: {
      response: Array<
        | {
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            type: 'http';
            url: string;
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            password?: {
              'hidden-secret'?: true;
            };
            platforms?: string[];
            username?: string;
          }
        | {
            access_key: string;
            bucket: string;
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            region: string;
            secret_key: {
              'hidden-secret'?: true;
            };
            type: 's3';
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            platforms?: string[];
            prefix?: string;
          }
        | {
            bucket: string;
            client_email: string;
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            private_key: {
              'hidden-secret'?: true;
            };
            type: 'gcs';
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            platforms?: string[];
            prefix?: string;
          }
        | {
            appId: string;
            appName: string;
            appconnectIssuer: string;
            appconnectKey: string;
            appconnectPrivateKey: string;
            bundleId: string;
            id: string;
            name: string;
            type: 'appStoreConnect';
          }
      >;
    };
    /** addProjectSymbolSource (public) */
    POST: {
      response:
        | {
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            type: 'http';
            url: string;
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            password?: {
              'hidden-secret'?: true;
            };
            platforms?: string[];
            username?: string;
          }
        | {
            access_key: string;
            bucket: string;
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            region: string;
            secret_key: {
              'hidden-secret'?: true;
            };
            type: 's3';
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            platforms?: string[];
            prefix?: string;
          }
        | {
            bucket: string;
            client_email: string;
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            private_key: {
              'hidden-secret'?: true;
            };
            type: 'gcs';
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            platforms?: string[];
            prefix?: string;
          }
        | {
            appId: string;
            appName: string;
            appconnectIssuer: string;
            appconnectKey: string;
            appconnectPrivateKey: string;
            bundleId: string;
            id: string;
            name: string;
            type: 'appStoreConnect';
          };
    };
    /** updateProjectSymbolSource (public) */
    PUT: {
      response:
        | {
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            type: 'http';
            url: string;
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            password?: {
              'hidden-secret'?: true;
            };
            platforms?: string[];
            username?: string;
          }
        | {
            access_key: string;
            bucket: string;
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            region: string;
            secret_key: {
              'hidden-secret'?: true;
            };
            type: 's3';
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            platforms?: string[];
            prefix?: string;
          }
        | {
            bucket: string;
            client_email: string;
            id: string;
            layout: {
              type:
                | 'native'
                | 'symstore'
                | 'symstore_index2'
                | 'ssqp'
                | 'unified'
                | 'debuginfod'
                | 'slashsymbols';
              casing?: 'lowercase' | 'uppercase' | 'default';
            };
            private_key: {
              'hidden-secret'?: true;
            };
            type: 'gcs';
            filters?: {
              filetypes?: Array<
                | 'pe'
                | 'pdb'
                | 'portablepdb'
                | 'mach_debug'
                | 'mach_code'
                | 'elf_debug'
                | 'elf_code'
                | 'wasm_debug'
                | 'wasm_code'
                | 'breakpad'
                | 'sourcebundle'
                | 'uuidmap'
                | 'bcsymbolmap'
                | 'il2cpp'
                | 'proguard'
                | 'dartsymbolmap'
              >;
              path_patterns?: string[];
              requires_checksum?: boolean;
            };
            has_index?: boolean;
            is_public?: boolean;
            name?: string;
            platforms?: string[];
            prefix?: string;
          }
        | {
            appId: string;
            appName: string;
            appconnectIssuer: string;
            appconnectKey: string;
            appconnectPrivateKey: string;
            bundleId: string;
            id: string;
            name: string;
            type: 'appStoreConnect';
          };
    };
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/tags/': {
    /** List a Project's Tag Keys (private) */
    GET: {response: ListProjectTagKeys};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/tags/$key/': {
    /** Retrieve a Tag Key (private) */
    GET: {response: TagKeyResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/tags/$key/values/': {
    /** List a Tag's Values (private) */
    GET: {
      response: Array<{
        name: string;
      }>;
    };
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/teams/': {
    /** listProjectTeams (public) */
    GET: {response: ProjectTeamsResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/teams/$teamIdOrSlug/': {
    /** deleteProjectTeam (public) */
    DELETE: {response: ProjectWithTeam};
    /** addProjectTeam (public) */
    POST: {response: ProjectWithTeam};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/': {
    /** Create an Uptime Monitor (experimental) */
    POST: {response: UptimeDetector};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/': {
    /** Retrieve an Uptime Alert Rule for a Project (experimental) */
    GET: {response: UptimeDetector};
    /** Update an Uptime Monitor for a Project (experimental) */
    PUT: {response: UptimeDetector};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/response-captures/': {
    /** Delete All Uptime Response Captures (experimental) */
    DELETE: {response: Record<string, unknown>};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/response-captures/$captureId/': {
    /** Retrieve an Uptime Response Capture (experimental) */
    GET: {response: Record<string, unknown>};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/user-feedback/': {
    /** List a Project's User Feedback (public) */
    GET: {
      response: Array<{
        comments: string;
        dateCreated: string;
        email: string;
        event: {
          eventID?: string;
          id?: string | null;
        };
        eventID: string;
        id: string;
        issue: Record<string, unknown> | null;
        name: string;
        user: Record<string, unknown> | null;
      }>;
    };
    /** Submit User Feedback (public) */
    POST: {
      response: {
        comments: string;
        dateCreated: string;
        email: string;
        event: {
          eventID?: string;
          id?: string | null;
        };
        eventID: string;
        id: string;
        issue: Record<string, unknown> | null;
        name: string;
        user: Record<string, unknown> | null;
      };
    };
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/user-issue/': {
    /** Create a user defined issue (experimental) */
    POST: {response: ProjectUserIssueResponse};
  };
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/users/': {
    /** listProjectUsers (public) */
    GET: {response: ListProjectUsersResponse};
  };
  '/seer/models/': {
    /** listSeerModels (public) */
    GET: {response: SeerModelsResponse};
  };
  '/sentry-app-installations/$uuid/': {
    /** Retrieve a Sentry App Installation (private) */
    GET: {response: SentryAppInstallation};
    /** Update a Sentry App Installation (private) */
    PUT: {response: SentryAppInstallation};
  };
  '/sentry-app-installations/$uuid/external-issues/': {
    /** Create or update an External Issue (private) */
    POST: {
      response: {
        displayName: string;
        id: string;
        issueId: string;
        serviceType: string;
        webUrl: string;
      };
    };
  };
  '/sentry-apps/$sentryAppIdOrSlug/': {
    /** getSentryApp (public) */
    GET: {response: SentryAppDetailsResponse};
    /** updateSentryApp (public) */
    PUT: {response: SentryAppDetailsResponse};
  };
  '/sentry-apps/$sentryAppIdOrSlug/features/': {
    /** List a Custom Integration's Features (private) */
    GET: {response: ListSentryAppFeatures};
  };
  '/sentry-apps/$sentryAppIdOrSlug/stats/': {
    /** Retrieve a Sentry App's Install/Uninstall Stats (private) */
    GET: {response: SentryAppStats};
  };
  '/teams/$organizationIdOrSlug/$teamIdOrSlug/': {
    /** getTeam (public) */
    GET: {response: Team};
    /** updateTeam (public) */
    PUT: {response: Team};
  };
  '/teams/$organizationIdOrSlug/$teamIdOrSlug/external-teams/': {
    /** createTeamExternalTeam (public) */
    POST: {response: ExternalActor};
  };
  '/teams/$organizationIdOrSlug/$teamIdOrSlug/external-teams/$externalTeamId/': {
    /** updateTeamExternalTeam (public) */
    PUT: {response: ExternalActor};
  };
  '/teams/$organizationIdOrSlug/$teamIdOrSlug/members/': {
    /** listTeamMembers (public) */
    GET: {response: ListMemberOnTeamResponse};
  };
  '/teams/$organizationIdOrSlug/$teamIdOrSlug/projects/': {
    /** listTeamProjects (public) */
    GET: {response: ListTeamProjectResponse};
    /** createTeamProject (public) */
    POST: {response: ProjectSummary};
  };
  '/users/$userId/organizations/': {
    /** List a User's Organizations (private) */
    GET: {response: ListUserOrganizations};
  };
};
