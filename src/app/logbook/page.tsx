"use client";

import React, { useState, useEffect } from "react";
import DynamicTable from "@/components/DynamicTable";
import FilterButton from "@/components/FilterButton";
import {
  monthFilterOptions,
  productFilterOptions,
  userFilterOptions,
} from "@/constants/filterOptions";
import { getSessionInfo, fetchAdminLogbook, fetchWorkerLogbook } from "@/constants/api";
import styles from "./LogbookPage.module.css";
import type { AdminLogbookEntry, UserLogbookEntry } from "@/types/Logbook";

const { isAdminMode, currentUser } = getSessionInfo();

const adminColumns = [
  { key: "batchCode", label: "Lote" },
  { key: "product",   label: "Producto" },
  { key: "worker",    label: "Responsable" },
  { key: "finishedAt",label: "Fecha" },
  { key: "status",    label: "Estado" },
  { key: "details",   label: "Detalles", isButton: true },
];

const workerColumns = [
  { key: "taskName",   label: "Tarea" },
  { key: "finishedAt", label: "Fecha" },
  { key: "details",    label: "Detalles", isButton: true },
];


const Logbook = () => {
  const [selectedProduct, setSelectedProduct] = useState(productFilterOptions[0]);
  const [selectedUser, setSelectedUser]   = useState(userFilterOptions[0]);
  const [selectedMonth, setSelectedMonth] = useState(monthFilterOptions[0]);

  const [tasks, setTasks] = useState<Array<AdminLogbookEntry | UserLogbookEntry>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogbookData = async () => {
      setIsLoading(true);
      const filters = {
        productId: selectedProduct.value,
        workerId: selectedUser.value,
        month: selectedMonth.value,
      };

      try {
        if (isAdminMode) {
          const data = await fetchAdminLogbook(filters);
          setTasks(data);
        } else {
          const data = await fetchWorkerLogbook(filters);
          setTasks(data);
        }
      } catch (error) {
        console.error("Error fetching logbook data:", error);
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLogbookData();
  }, [selectedProduct, selectedUser, selectedMonth])
  const tableData = tasks.map((task) => {
    if ("batchCode" in task) {
      return {
        ...task,
        details: { text: "Ver", idProceso: task.processRunId },
      };
    } else {
      return {
        ...task,
        details: { text: "Ver", idProceso: task.processRunId, stepId: task.stepExecutionId },
      };
    }
  });

  return (
    <>
      <div className={`${styles.wrapper} page`}>
        <h1 className={styles.title}>Bitácora</h1>

        {!isAdminMode && (
          <div style={{ textAlign: "center", margin: "10px 0" }}>
            <h2>{currentUser}</h2>
          </div>
        )}

        <div className={styles.filters}>
          <FilterButton
            title="Filtrar por producto"
            options={productFilterOptions}
            onChange={setSelectedProduct}
          />
          {isAdminMode && (
            <FilterButton
              title="Filtrar por usuario"
              options={userFilterOptions}
              onChange={setSelectedUser}
            />
          )}
          <FilterButton
            title="Filtrar por mes"
            options={monthFilterOptions}
            onChange={setSelectedMonth}
          />
        </div>
      </div>

        <div className={styles.tableWrapper}>
        {isLoading ? (
          <p>Cargando bitácora...</p>
        ) : (
          <DynamicTable
            columns={isAdminMode ? adminColumns : workerColumns}
            data={tableData}
            isAdminMode={isAdminMode}
          />
        )}
        </div>
    </>
  );
};

export default Logbook;
