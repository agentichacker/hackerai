import { makeSecretProviderDefinitionRegistry } from "@hackerai/secret-provider-core/shared/definition";
import * as OnePassword from "@hackerai/secret-provider-onepassword/shared/definition";

export const builtInSecretProviderDefinitions = makeSecretProviderDefinitionRegistry([
  OnePassword.definition,
]);
