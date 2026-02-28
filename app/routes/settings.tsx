import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/settings";
import { prisma } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/alert";
import { useLanguage } from "~/lib/language";

export function meta() {
  return [{ title: "Settings - NhaTro" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }
  return { settings: settingsMap };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-motel-info") {
    const updates = [
      { key: "motel_name", value: formData.get("motel_name") as string },
      { key: "motel_address", value: formData.get("motel_address") as string },
      { key: "motel_phone", value: formData.get("motel_phone") as string },
    ];

    for (const { key, value } of updates) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: value || "" },
        update: { value: value || "" },
      });
    }
  }

  if (intent === "save-rates") {
    const defaultRoomRate = formData.get("default_room_rate") as string;
    const updates = [
      { key: "default_room_rate", value: defaultRoomRate },
      { key: "electric_rate", value: formData.get("electric_rate") as string },
      { key: "water_rate", value: formData.get("water_rate") as string },
      { key: "currency", value: formData.get("currency") as string },
    ];

    for (const { key, value } of updates) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: value || "" },
        update: { value: value || "" },
      });
    }

    // Update all rooms to the new default rate
    if (defaultRoomRate) {
      await prisma.room.updateMany({
        data: { rate: Number(defaultRoomRate) },
      });
    }
  }

  return { ok: true };
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const saved = actionData && "ok" in actionData;
  const { t } = useLanguage();

  return (
    <PageContainer>
      <Header title={t("settings.title")} description={t("settings.description")} />

      {saved && (
        <Alert variant="success" className="mb-6">
          {t("settings.savedSuccess")}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Motel Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.motelInfo")}</CardTitle>
          </CardHeader>
          <Form method="post">
            <input type="hidden" name="intent" value="save-motel-info" />
            <div className="space-y-4">
              <Input
                id="motel_name"
                label={t("settings.motelName")}
                name="motel_name"
                defaultValue={settings.motel_name || ""}
                placeholder={t("settings.motelNamePlaceholder")}
              />
              <Input
                id="motel_address"
                label={t("settings.address")}
                name="motel_address"
                defaultValue={settings.motel_address || ""}
                placeholder={t("settings.addressPlaceholder")}
              />
              <Input
                id="motel_phone"
                label={t("common.phone")}
                name="motel_phone"
                defaultValue={settings.motel_phone || ""}
                placeholder={t("settings.phonePlaceholder")}
              />
            </div>
            <div className="mt-6">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("settings.saveMotelInfo")}
              </Button>
            </div>
          </Form>
        </Card>

        {/* Rates */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.defaultRates")}</CardTitle>
          </CardHeader>
          <Form method="post">
            <input type="hidden" name="intent" value="save-rates" />
            <div className="space-y-4">
              <Input
                id="default_room_rate"
                label={t("settings.defaultRoomRate")}
                name="default_room_rate"
                type="number"
                defaultValue={settings.default_room_rate || "3000000"}
              />
              <Input
                id="electric_rate"
                label={t("settings.electricityRate")}
                name="electric_rate"
                type="number"
                defaultValue={settings.electric_rate || "3500"}
              />
              <Input
                id="water_rate"
                label={t("settings.waterRate")}
                name="water_rate"
                type="number"
                defaultValue={settings.water_rate || "20000"}
              />
              <Input
                id="currency"
                label={t("settings.currency")}
                name="currency"
                defaultValue={settings.currency || "VND"}
                placeholder="VND"
              />
            </div>
            <div className="mt-6">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("settings.saveRates")}
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </PageContainer>
  );
}
