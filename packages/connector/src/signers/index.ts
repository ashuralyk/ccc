import { ccc } from "@ckb-ccc/ccc";
import { ReactiveControllerHost } from "lit";

export class SignersController {
  public wallets: ccc.WalletWithSigners[] = [];

  private readonly controller = new ccc.SignersController();

  constructor(
    private readonly host: ReactiveControllerHost & {
      client: ccc.Client;
      signerFilter?: (
        signerInfo: ccc.SignerInfo,
        wallet: ccc.Wallet,
      ) => Promise<boolean>;
      preferredNetworks?: ccc.NetworkPreference[];
      name?: string;
      icon?: string;
      refreshSigner: () => void;
    },
  ) {
    host.addController(this);
  }

  refresh() {
    this.controller.refresh(
      this.host.client,
      (wallets) => {
        this.wallets = [...wallets];
        this.update();
      },
      this.host,
    );
  }

  update() {
    this.host.refreshSigner();
    this.host.requestUpdate();
  }

  hostConnected(): void {
    this.refresh();
    // Wait for plugins to be loaded
    setTimeout(() => this.refresh(), 500);
  }

  hostDisconnected(): void {
    this.controller.disconnect();
  }
}
