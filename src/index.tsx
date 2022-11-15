import React from "react";
import ReactDOM from "react-dom";
import { createBrowserRouter, RouterProvider, redirect } from "react-router-dom";
import { Web3ReactProvider } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import App from "./App";
import CreateInBatch from "./CreateInBatch";

import "decentraland-ui/lib/styles.css";
import "./index.css";
import CreateSingle from "./components/v2/CreateSingle";
import CreateBatch from "./components/v2/CreateBatch";

function getLibrary(provider: any) {
  return new Web3Provider(provider);
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/batch",
    element: <CreateInBatch />,
  },
  {
    path: "/v2",
    element: <CreateSingle />,
  },
  {
    path: "/v2/batch",
    element: <CreateBatch />,
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
]);

ReactDOM.render(
  <Web3ReactProvider getLibrary={getLibrary}>
    <RouterProvider router={router} />
  </Web3ReactProvider>,
  document.getElementById("root")
);
