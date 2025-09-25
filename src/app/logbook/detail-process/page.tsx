"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSessionInfo, fetchProcessRunDetails, fetchStepExecutionDetails } from "@/constants/api";
import { Calendar, Clock, User } from "lucide-react";
import styles from "@/styles/DetailProcess.module.css";
import UnitField from "@/components/UnitField2";
import HeaderXuchil from "@/components/HeaderXuchil";
import type { ProcessRunDetails, StepExecutionDetails } from "@/types/Logbook";

const { isAdminMode } = getSessionInfo();

const DetailProcess = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const processRunId = searchParams.get("id");
  const stepExecutionId = searchParams.get("stepId");

  const [details, setDetails] = useState<ProcessRunDetails | StepExecutionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (isAdminMode && processRunId) {
          const data = await fetchProcessRunDetails(processRunId);
          setDetails(data);
        } else if (!isAdminMode && stepExecutionId) {
          const data = await fetchStepExecutionDetails(stepExecutionId);
          setDetails(data);
        } else {
          // Redirigir o mostrar error si faltan parámetros
          router.push("/logbook");
        }
      } catch (error) {
        console.error("Error fetching details:", error);
        setDetails(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails(); 
  }, [processRunId, stepExecutionId, router]);

  if (isLoading) return <p>Cargando detalles...</p>;
  if (!details) return <p>No se encontraron los detalles del proceso o actividad.</p>;

  return (
    <div className={styles.container}>
      <HeaderXuchil />
      <h1 className={styles.title}>Producto: {details.productName}</h1>
      {isAdminMode && 'batchCode' in details && (

        <>
          <h3 className={styles.processId}>Lote no. <span>{details.batchCode}</span></h3>

          <div className={styles.dateRange}>
            <Calendar size={18} />
            <span>{new Date(details.startedAt).toLocaleDateString()} - {new Date(details.finishedAt).toLocaleDateString()}</span>
          </div>

          <div className={styles.timelineContainer}>
            <ul className={styles.timeline}>
              {details.steps.map((step, index) => (
                <li key={index}>
                  <div className={styles.dot}></div>
                  <div>
                    <strong>
                      {step.name} <User size={16} style={{ marginLeft: 6 }} />
                    </strong>
                    <div className={styles.dateTime}>
                      <span>{step.startedAt} - {step.finishedAt}</span>
                    </div>
                    <p className={styles.responsible}>Responsable: {step.worker}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <UnitField titulo="Producto Terminado" cantidad={details.goodOutputQty} unidad={details.outputUnit} />
          <UnitField titulo="Merma" cantidad={details.scrapQty} unidad={details.outputUnit} />

          <div className={styles.observations}>
            <h4>Observaciones</h4>
            <div className={styles.noteCard}>
              <p>{details.notes || 'Sin observaciones.'}</p>
            </div>
          </div>
        </>
      )}

      {!isAdminMode && 'taskName' in details && (
        <>
          <h2 className={styles.activityTitle}>Actividad: {details.taskName}</h2>
 

      <div className={styles.infoRow}>
        <Calendar size={18} />
        <span>{new Date(details.finishedAt).toLocaleDateString()}</span>
      </div>

      <div className={styles.infoRow}>
        <Clock size={18} />
        <span>{new Date(details.startedAt).toLocaleTimeString()} - {new Date(details.finishedAt).toLocaleTimeString()}</span>
      </div>

      <div className={styles.unitFieldWrapper}>
          {details.inputQty && <UnitField titulo="Materia Prima Usada" cantidad={details.inputQty} unidad={details.inputUnit} />}
      </div>
      <div className={styles.observations}>
        <h4>Observaciones de la Tarea</h4>
        <div className={styles.noteCard}>
          <p>{details.notes || 'Sin observaciones.'}</p>
        </div>
      </div>
    </>
  )}

    </div>
  );
};

export default DetailProcess;
