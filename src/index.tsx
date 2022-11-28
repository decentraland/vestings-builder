import React from "react";
import ReactDOM from "react-dom";
import { createBrowserRouter, RouterProvider, redirect } from "react-router-dom";
import { Web3ReactProvider } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import CreateSingleV1 from "./components/v1/CreateSingle";
import CreateBatchV1 from "./components/v1/CreateBatch";
import CreateSingleV2 from "./components/v2/CreateSingle";
import CreateBatchV2 from "./components/v2/CreateBatch";
import "decentraland-ui/lib/styles.css";
import "./index.css";

function getLibrary(provider: any) {
  return new Web3Provider(provider);
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <CreateSingleV2 />,
  },
  {
    path: "/batch",
    element: <CreateBatchV2 />,
  },
  {
    path: "/old",
    element: <CreateSingleV1 />,
  },
  {
    path: "/old/batch",
    element: <CreateBatchV1 />,
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
